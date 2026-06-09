import { test, expect } from "@playwright/test";
import path from "path";
import { FlowsheetPage } from "../../pages/flowsheet.page";
import { waitForSSEConnected } from "../../helpers/sse-wait";
import { triggerFlowsheetSyncNotify } from "../../helpers/internal-refetch";
import { ensureOffAirInFreshContext } from "../../helpers/flowsheet-cleanup";

const authDir = path.join(__dirname, "..", "..", ".auth");
const DJ_STORAGE = path.join(authDir, "dj2.json");

// Matches both invalidate targets the receiver fires (Flowsheet -> /?page=,
// NowPlaying -> /latest). Mirrors the regex in polling-rate.spec.ts.
const FLOWSHEET_REFETCH_RE = /\/flowsheet\/(latest\b|\?page=)/;

/**
 * Serial mode: dj2.json is the only authed storage state available
 * (dj.json is invalidated by auth/logout.spec.ts), so a parallel sibling
 * test in this file would race the afterAll ensureOffAir.
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
        FLOWSHEET_REFETCH_RE.test(resp.url()) &&
        resp.request().method() === "GET" &&
        resp.status() === 200,
      { timeout: 5_000 }
    );

    await triggerFlowsheetSyncNotify();

    const resp = await refetchResp;
    expect(resp.ok()).toBe(true);
  });
});
