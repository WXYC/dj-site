import { test, expect, Browser, Page } from "@playwright/test";
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
 * Strategy: `pg_notify('cdc', <json>)` bypasses the LML enrichment chain so
 * tests can exercise just the CDC -> broadcast -> SSE -> DOM segment.
 * Backend-Service's setupMetadataBroadcast filter rebroadcasts the matching
 * payload verbatim as a `liveFs:update` SSE event within ms.
 *
 * Why one file: dj2.json is the only authenticated state available (dj.json
 * is invalidated by auth/logout.spec.ts), so per-test DJ isolation isn't
 * possible. Single-worker serialisation prevents an afterAll's `ensureOffAir`
 * from racing a sibling test on a parallel worker.
 */
test.describe("SSE Tier 1 — round-trip", () => {
  test.use({ storageState: DJ_STORAGE });
  test.describe.configure({ mode: "serial" });
  test.setTimeout(90_000);

  test.beforeAll(async ({ browser }) => {
    // One-time go-live so each test's `ensureLive` is a fast no-op instead
    // of paying the ~3s status-probe + click + reload chain. Also seeds a
    // song row so /latest renders a real album-art <img> (not a show-start
    // icon) for tests #2/#3 to assert on.
    await withAuthedFlowsheet(browser, async (fs) => {
      await fs.ensureLive();
      await addRow(fs, "Stereolab", "Aluminum Tunes");
    });
  });

  test.afterAll(async ({ browser }) => {
    await withAuthedFlowsheet(browser, async (fs) => {
      await fs.ensureOffAir();
    });
  });

  /**
   * Test #1: a `liveFs:update` for an in-cache dashboard row patches the
   * row's mutated fields into the rendered DOM within 5s. Pins the
   * cache-patch path (id-in-cache branch of routeUpdateEvent).
   */
  test("liveFs:update patches an in-cache dashboard row within 5s", async ({ page }) => {
    const fs = new FlowsheetPage(page);
    await fs.goto();
    await fs.waitForEntriesLoaded();
    await fs.ensureLive();
    const row = await addRow(fs, "Juana Molina", "DOGA");

    // NOTIFY before handshake completes is silently lost (LISTEN/NOTIFY has
    // no replay).
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
  test("/live anonymous viewer receives liveFs:update with no cookies", async ({ browser }) => {
    await withAnonLive(browser, async ({ anonPage, latestRowId, handshake }) => {
      expect(handshake.status()).toBe(200);
      expect(handshake.headers()["content-type"]).toContain("text/event-stream");

      const newArtworkUrl = `https://example.org/tier1-anon-${latestRowId}.jpg`;
      await pgNotify(
        "cdc",
        buildFlowsheetUpdatePayload({ id: latestRowId, artwork_url: newArtworkUrl })
      );
      await expect(anonPage.locator(`img[src="${newArtworkUrl}"]`).first()).toBeVisible({
        timeout: 5_000,
      });
    });
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
    await withAnonLive(browser, async ({ anonPage, latestRowId }) => {
      const artworkUrl = `https://example.org/tier1-fullrow-${latestRowId}-bs2.jpg`;
      await pgNotify(
        "cdc",
        buildFlowsheetUpdatePayload({ id: latestRowId, artwork_url: artworkUrl })
      );
      await expect(anonPage.locator(`img[src="${artworkUrl}"]`).first()).toBeVisible({
        timeout: 5_000,
      });
    });
  });
});

/**
 * Run `body` against a fresh authed FlowsheetPage and clean up the context
 * afterwards. Used by beforeAll/afterAll for go-live + cleanup.
 */
async function withAuthedFlowsheet(
  browser: Browser,
  body: (fs: FlowsheetPage) => Promise<void>
): Promise<void> {
  const context = await browser.newContext({ storageState: DJ_STORAGE, baseURL: BASE_URL });
  try {
    const page = await context.newPage();
    const fs = new FlowsheetPage(page);
    await fs.goto();
    await fs.waitForEntriesLoaded();
    await body(fs);
  } finally {
    await context.close();
  }
}

/**
 * Open an anonymous /live, wait for the SSE handshake, capture whichever id
 * /flowsheet/latest returned, and pass them to `body`.
 *
 * The "whichever id" matters: /latest is globally scoped, so parallel tests
 * adding rows can shift it. The test stays robust by NOTIFYing for the id
 * that /live's own getNowPlaying cache actually has, instead of asserting on
 * a row we hope is still latest.
 */
async function withAnonLive(
  browser: Browser,
  body: (ctx: {
    anonPage: Page;
    latestRowId: number;
    handshake: Awaited<ReturnType<typeof waitForSSEHandshake>>;
  }) => Promise<void>
): Promise<void> {
  const anonContext = await browser.newContext({ baseURL: BASE_URL });
  try {
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
    const latestRow = await (await latestRespPromise).json();
    expect(typeof latestRow?.id).toBe("number");
    await body({ anonPage, latestRowId: latestRow.id, handshake });
  } finally {
    await anonContext.close();
  }
}

async function addRow(
  fs: FlowsheetPage,
  artist: string,
  album: string
): Promise<{ id: number }> {
  const addResp = fs.page.waitForResponse(
    (r) =>
      r.url().includes("/flowsheet/") &&
      r.request().method() === "POST" &&
      r.status() < 300,
    { timeout: 30_000 }
  );
  await fs.addTrack({ song: `tier1-${Date.now()}`, artist, album });
  const row = await (await addResp).json();
  expect(typeof row.id).toBe("number");
  return row;
}
