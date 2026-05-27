import { test, expect, Page } from "@playwright/test";
import path from "path";
import { FlowsheetPage } from "../../pages/flowsheet.page";
import { waitForSSEConnected } from "../../helpers/sse-wait";

const authDir = path.join(__dirname, "..", "..", ".auth");
const DJ_STORAGE = path.join(authDir, "dj2.json");

const POLL_WINDOW_MS = 90_000;

/**
 * Matches the two `/flowsheet/*` endpoints whose pollingInterval is governed
 * by `useFlowsheetPollingInterval`:
 *   - `/flowsheet/`            (getInfiniteEntries, with `?page=…&limit=…`)
 *   - `/flowsheet/latest`      (getNowPlaying)
 *
 * Deliberately excludes `/flowsheet/djs-on-air`, which is a separate query
 * on a fixed 60s interval not tied to SSE state — counting it here would
 * mask the SSE slowdown.
 */
const FLOWSHEET_POLL_RE = /\/flowsheet\/(latest\b|\?page=)/;

/**
 * SSE Tier 2 — polling rate. Pins the SSE-connected slowdown of the safety
 * poll: `useFlowsheetPollingInterval` returns SLOW=300s when connected and
 * FAST=60s otherwise (lib/features/flowsheet/constants.ts +
 * src/hooks/useSSEConnection.ts:44-49). A regression here re-introduces
 * duplicate work and inflates Backend-Service traffic.
 *
 * Strategy: capture every `/flowsheet/(latest|?page=…)` GET via
 * `page.on("request")`, settle the initial RTK Query fetches, then count
 * NEW requests during a 90s window. With SLOW=300s the next poll is well
 * past the window's right edge (expect 0). With FAST=60s the next poll
 * fires comfortably inside the window (expect ≥1).
 *
 * The two scenarios are separate `test()` calls so each gets a fresh page
 * (clean request listeners) and so a failure in one doesn't leak the
 * `page.route` block into the other.
 */
test.describe("SSE Tier 2 — polling rate", () => {
  test.use({ storageState: DJ_STORAGE });
  test.describe.configure({ mode: "serial" });
  test.setTimeout(180_000);

  test.afterAll(async ({ browser }) => {
    const context = await browser.newContext({ storageState: DJ_STORAGE });
    try {
      const page = await context.newPage();
      const fs = new FlowsheetPage(page);
      await fs.goto();
      await fs.waitForEntriesLoaded();
      await fs.ensureOffAir();
    } finally {
      await context.close();
    }
  });

  test("SSE connected: zero /flowsheet polls in a 90s window (slow cadence)", async ({
    page,
  }) => {
    const fs = new FlowsheetPage(page);
    await fs.goto();
    await fs.waitForEntriesLoaded();
    await fs.ensureLive();

    await waitForSSEConnected(page);

    const pollCount = await countFlowsheetPolls(page, POLL_WINDOW_MS);
    expect(pollCount).toBe(0);
  });

  test("SSE blocked: at least one /flowsheet poll in a 90s window (fast cadence)", async ({
    page,
  }) => {
    await page.route("**/events/stream*", (route) => route.abort());

    const fs = new FlowsheetPage(page);
    await fs.goto();
    await fs.waitForEntriesLoaded();

    const indicator = page.locator('[aria-label^="Live updates:"][data-status]');
    await expect(indicator).not.toHaveAttribute("data-status", "connected", {
      timeout: 5_000,
    });

    const pollCount = await countFlowsheetPolls(page, POLL_WINDOW_MS);
    expect(pollCount).toBeGreaterThanOrEqual(1);
  });
});

/**
 * Wait for the page to settle (initial flowsheet GETs landed), then count
 * matching GET requests for `windowMs`. Returns the post-settle count.
 *
 * The "settle" step is a single `waitForLoadState("networkidle")` — RTK
 * Query fires its initial fetches synchronously on mount, so networkidle is
 * a tight upper bound on when the timing window can start.
 */
async function countFlowsheetPolls(page: Page, windowMs: number): Promise<number> {
  await page.waitForLoadState("networkidle");

  let count = 0;
  const onRequest = (req: import("@playwright/test").Request) => {
    if (req.method() !== "GET") return;
    if (FLOWSHEET_POLL_RE.test(req.url())) count++;
  };
  page.on("request", onRequest);
  try {
    await page.waitForTimeout(windowMs);
  } finally {
    page.off("request", onRequest);
  }
  return count;
}
