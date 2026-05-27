import { test, expect, BrowserContext } from "@playwright/test";
import path from "path";
import { FlowsheetPage } from "../../pages/flowsheet.page";
import { pgNotify } from "../../helpers/pg-notify";
import { waitForSSEConnected, waitForSSEHandshake } from "../../helpers/sse-wait";
import { buildFlowsheetUpdatePayload } from "../../fixtures/sse-cdc-payloads";

const authDir = path.join(__dirname, "..", "..", ".auth");
const BASE_URL = process.env.E2E_BASE_URL || "http://localhost:3000";
const DJ_STORAGE = path.join(authDir, "dj2.json");

/**
 * Tier 1 SSE round-trip — pins the cross-repo Live Updates contract.
 *
 * All three tests live in one spec file (one worker) so the file-scoped
 * afterAll's `ensureOffAir` can't race a sibling test mid-NOTIFY. dj2.json
 * is the only authenticated state available for flowsheet tests (dj.json
 * gets invalidated by auth/logout.spec.ts), so per-test DJ isolation isn't
 * possible — single-worker serialisation is the cleanest fix.
 *
 * Strategy: `pg_notify('cdc', <json>)` bypasses the LML enrichment chain.
 * BS's setupMetadataBroadcast filter rebroadcasts the matching payload
 * verbatim as a `liveFs:update` SSE event within ms. See plan in
 * docs/plans/sse-tier1-e2e.md.
 *
 * Pins for review:
 *   1. cross-DJ update on dashboard       — BS-1 + BS-2 + listener cache-patch path
 *   2. anonymous /live receives update    — LIVE_FS_PUBLIC_TOPIC_NO_AUTH invariant
 *   3. full-row artwork_url renders       — LIVE_FS_UPDATE_INCLUDES_FULL_ROW invariant
 */
test.describe("SSE Tier 1 — round-trip", () => {
  test.use({ storageState: DJ_STORAGE });
  test.describe.configure({ mode: "serial" });
  test.setTimeout(90_000);

  test.afterAll(async ({ browser }) => {
    const context = await browser.newContext({
      storageState: DJ_STORAGE,
      baseURL: BASE_URL,
    });
    const page = await context.newPage();
    const fs = new FlowsheetPage(page);
    await fs.goto();
    await fs.waitForEntriesLoaded();
    await fs.ensureOffAir();
    await context.close();
  });

  async function goLiveAndAddRow(
    fs: FlowsheetPage,
    songName: string,
    artist: string,
    album: string
  ): Promise<{ id: number }> {
    await fs.goto();
    await fs.waitForEntriesLoaded();
    const isLive = await expect(fs.liveStatus)
      .toContainText("On Air", { timeout: 15_000 })
      .then(() => true)
      .catch(() => false);
    if (!isLive) await fs.goLive();

    const addResp = fs.page.waitForResponse(
      (r) =>
        r.url().includes("/flowsheet/") &&
        r.request().method() === "POST" &&
        r.status() < 300,
      { timeout: 30_000 }
    );
    await fs.addTrack({ song: songName, artist, album });
    const row = await (await addResp).json();
    expect(typeof row.id).toBe("number");
    return row;
  }

  /**
   * Test #1: a `liveFs:update` for an in-cache dashboard row patches the
   * row's mutated fields into the rendered DOM within 5s. Pins the
   * cache-patch path (id-in-cache branch of routeUpdateEvent).
   */
  test("liveFs:update patches an in-cache dashboard row within 5s", async ({ page }) => {
    const flowsheet = new FlowsheetPage(page);
    const ts = Date.now();
    const row = await goLiveAndAddRow(
      flowsheet,
      `tier1-update-${ts}`,
      "Juana Molina",
      "DOGA"
    );

    // SSE must be connected before NOTIFY fires, or the broadcast is lost.
    await waitForSSEConnected(page);

    const newArtworkUrl = `https://example.org/tier1-update-${row.id}.jpg`;
    await pgNotify(
      "cdc",
      buildFlowsheetUpdatePayload({ id: row.id, artwork_url: newArtworkUrl })
    );

    const entry = page.locator(`[data-testid="flowsheet-entry-${row.id}"]`);
    await expect(entry.locator("img").first()).toHaveAttribute(
      "src",
      newArtworkUrl,
      { timeout: 5_000 }
    );
  });

  /**
   * Test #2: anonymous `/live` viewer receives the same update without
   * cookies. Pins LIVE_FS_PUBLIC_TOPIC_NO_AUTH — if BS-1's route-level auth
   * guard is reinstated, the handshake fails on status 401/403.
   */
  test("/live anonymous viewer receives liveFs:update with no cookies", async ({
    browser,
  }) => {
    const authedContext = await browser.newContext({
      storageState: DJ_STORAGE,
      baseURL: BASE_URL,
    });
    const anonContext = await browser.newContext({ baseURL: BASE_URL });

    try {
      // Ensure /live has *something* to render. /latest is globally scoped
      // (returns the most recent flowsheet row across all DJs), so we can't
      // assume the row we add here is the one /live ends up showing — other
      // parallel tests may add rows too. The test stays robust by reading
      // whichever id /latest returned and NOTIFYing for *that*.
      const authedPage = await authedContext.newPage();
      const fs = new FlowsheetPage(authedPage);
      await goLiveAndAddRow(fs, `tier1-anon-${Date.now()}`, "Stereolab", "Aluminum Tunes");

      const anonPage = await anonContext.newPage();
      const handshakePromise = waitForSSEHandshake(anonPage, 15_000);
      const latestRespPromise = anonPage.waitForResponse(
        (r) =>
          /\/flowsheet\/latest\b/.test(r.url()) &&
          r.request().method() === "GET" &&
          r.status() === 200,
        { timeout: 15_000 }
      );
      await anonPage.goto("/live");
      const handshake = await handshakePromise;
      expect(handshake.status()).toBe(200);
      expect(handshake.headers()["content-type"]).toContain("text/event-stream");

      const latestRow = await (await latestRespPromise).json();
      expect(typeof latestRow?.id).toBe("number");

      const newArtworkUrl = `https://example.org/tier1-anon-${latestRow.id}.jpg`;
      await pgNotify(
        "cdc",
        buildFlowsheetUpdatePayload({ id: latestRow.id, artwork_url: newArtworkUrl })
      );

      await expect(anonPage.locator(`img[src="${newArtworkUrl}"]`).first()).toBeVisible({
        timeout: 5_000,
      });
    } finally {
      await closeContexts(authedContext, anonContext);
    }
  });

  /**
   * Test #3: surgical regression test for BS-2 — the broadcast carries the
   * full row, not just `{id, metadata_status}`. The unique artwork URL in
   * the payload must appear verbatim as an <img src>. If BS-2 reverts to
   * the minimal shape, tests #1 and #2 may incidentally pass (the cache
   * patch is a shallow merge; prior artwork sticks around), but the new
   * artwork field never renders.
   */
  test("artwork_url from the full-row payload renders on /live (BS-2 contract)", async ({
    browser,
  }) => {
    const authedContext = await browser.newContext({
      storageState: DJ_STORAGE,
      baseURL: BASE_URL,
    });
    const anonContext = await browser.newContext({ baseURL: BASE_URL });

    try {
      const authedPage = await authedContext.newPage();
      const fs = new FlowsheetPage(authedPage);
      await goLiveAndAddRow(fs, `tier1-fullrow-${Date.now()}`, "Cat Power", "Moon Pix");

      const anonPage = await anonContext.newPage();
      const handshakePromise = waitForSSEHandshake(anonPage, 15_000);
      // Capture whichever id /latest returns — same robustness rationale as
      // test #2. Test #3's payload is what BS-2 is on the hook for: the
      // artwork_url must arrive verbatim and render as an <img src>. If BS-2
      // ever reverts to `{id, metadata_status}`, this assertion is the one
      // that fails loudly.
      const latestRespPromise = anonPage.waitForResponse(
        (r) =>
          /\/flowsheet\/latest\b/.test(r.url()) &&
          r.request().method() === "GET" &&
          r.status() === 200,
        { timeout: 15_000 }
      );
      await anonPage.goto("/live");
      await handshakePromise;
      const latestRow = await (await latestRespPromise).json();
      expect(typeof latestRow?.id).toBe("number");

      const artworkUrl = `https://example.org/tier1-fullrow-${latestRow.id}-bs2.jpg`;
      await pgNotify(
        "cdc",
        buildFlowsheetUpdatePayload({ id: latestRow.id, artwork_url: artworkUrl })
      );

      await expect(anonPage.locator(`img[src="${artworkUrl}"]`).first()).toBeVisible({
        timeout: 5_000,
      });
    } finally {
      await closeContexts(authedContext, anonContext);
    }
  });
});

async function closeContexts(...contexts: BrowserContext[]): Promise<void> {
  for (const ctx of contexts) {
    await ctx.close().catch(() => {});
  }
}
