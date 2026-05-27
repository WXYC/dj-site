import { test } from "@playwright/test";
import path from "path";
import { FlowsheetPage } from "../../pages/flowsheet.page";
import { ensureOffAirInFreshContext } from "../../helpers/flowsheet-cleanup";
import { waitForSSEConnected, waitForSSEStatus } from "../../helpers/sse-wait";

const authDir = path.join(__dirname, "..", "..", ".auth");
const DJ_STORAGE = path.join(authDir, "dj2.json");

/**
 * SSE Tier 2 — reconnect. Pins the EventSource auto-reconnect path:
 * `onerror` with `readyState=CONNECTING` -> "reconnecting"; subsequent
 * `onopen` -> "connected" (see lib/features/flowsheet/live-updates-listener.ts).
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
    await ensureOffAirInFreshContext(browser, DJ_STORAGE);
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

    await context.setOffline(true);
    await waitForSSEStatus(page, "reconnecting");

    await context.setOffline(false);
    await waitForSSEStatus(page, "connected");
  });
});
