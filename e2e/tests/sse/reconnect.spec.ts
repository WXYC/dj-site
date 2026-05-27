import { test, expect } from "@playwright/test";
import path from "path";
import { FlowsheetPage } from "../../pages/flowsheet.page";
import { waitForSSEConnected } from "../../helpers/sse-wait";

const authDir = path.join(__dirname, "..", "..", ".auth");
const DJ_STORAGE = path.join(authDir, "dj2.json");

/**
 * SSE Tier 2 — reconnect. Pins the EventSource auto-reconnect path:
 * `onerror` with `readyState=CONNECTING` -> "reconnecting"; subsequent
 * `onopen` -> "connected". See live-updates-listener.ts:200-216.
 *
 * `page.context().setOffline()` is the right tool — `page.route(..., abort)`
 * only intercepts NEW requests, so it can't tear down the open EventSource.
 * Going offline kills the network stack, which fires the EventSource's
 * onerror; coming back online lets the browser's auto-retry succeed.
 *
 * The "missed pg_notify arrives via 5-min safety poll" assertion from the
 * issue spec is impractical in an E2E test (5-min wait) and is deferred to
 * Tier 3 (#662), which adds an explicit refetch event on reconnect.
 */
test.describe("SSE Tier 2 — reconnect", () => {
  test.use({ storageState: DJ_STORAGE });
  test.describe.configure({ mode: "serial" });
  test.setTimeout(60_000);

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

  test("EventSource transitions connected -> reconnecting -> connected on offline blip", async ({
    page,
    context,
  }) => {
    const fs = new FlowsheetPage(page);
    await fs.goto();
    await fs.waitForEntriesLoaded();
    await fs.ensureLive();

    await waitForSSEConnected(page);

    const indicator = page.locator('[aria-label^="Live updates:"][data-status]');

    await context.setOffline(true);
    await expect(indicator).toHaveAttribute("data-status", "reconnecting", {
      timeout: 10_000,
    });

    await context.setOffline(false);
    await expect(indicator).toHaveAttribute("data-status", "connected", {
      timeout: 10_000,
    });
  });
});
