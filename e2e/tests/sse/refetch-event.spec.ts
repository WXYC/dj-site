import { test, expect } from "@playwright/test";
import path from "path";
import { FlowsheetPage } from "../../pages/flowsheet.page";
import { waitForSSEConnected } from "../../helpers/sse-wait";
import { triggerFlowsheetSyncNotify } from "../../helpers/internal-refetch";
import { ensureOffAirInFreshContext } from "../../helpers/flowsheet-cleanup";

const authDir = path.join(__dirname, "..", "..", ".auth");
const DJ_STORAGE = path.join(authDir, "dj2.json");

/**
 * Tier 3 SSE refetch event — pins the cross-repo refetch path.
 *
 * Flow:
 *   POST /internal/flowsheet-sync-notify (X-Internal-Key)
 *     -> BS serverEventsMgr.broadcast(liveFs, { type: 'refetch', ... })
 *       -> dj-site listener middleware: scheduleDebouncedInvalidate(
 *            ['Flowsheet', 'NowPlaying']) after 500ms
 *         -> RTK Query re-fires GET /flowsheet/* for active subscribers.
 *
 * Polling is in slow mode (60s) while SSE is connected, so any GET
 * /flowsheet/* arriving within 5s of the trigger is attributable to the
 * refetch broadcast — there's no other plausible cause.
 *
 * Serial mode: encodes the same dj2.json constraint that the Tier 1 and
 * Tier 2 specs document (dj.json is invalidated by auth/logout.spec.ts).
 * Single test today, but a future second test in this file would race
 * `ensureOffAir` across parallel workers without this.
 */
test.describe("SSE Tier 3 — refetch event", () => {
  test.use({ storageState: DJ_STORAGE });
  test.describe.configure({ mode: "serial" });
  test.setTimeout(60_000);

  test.afterAll(async ({ browser }) => {
    await ensureOffAirInFreshContext(browser, DJ_STORAGE);
  });

  test("liveFs:refetch triggers a debounced GET /flowsheet/* within 5s", async ({ page }) => {
    const fs = new FlowsheetPage(page);
    await fs.goto();
    await fs.waitForEntriesLoaded();
    await fs.ensureLive();
    await waitForSSEConnected(page);

    const refetchResp = page.waitForResponse(
      (resp) =>
        /\/flowsheet\/?(\?|$)/.test(resp.url()) &&
        resp.request().method() === "GET" &&
        resp.status() === 200,
      { timeout: 5_000 }
    );

    await triggerFlowsheetSyncNotify();

    const resp = await refetchResp;
    expect(resp.ok()).toBe(true);
  });
});
