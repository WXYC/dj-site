import { test, expect, Page } from "@playwright/test";
import path from "path";
import {
  FLOWSHEET_POLL_FAST_MS,
  FLOWSHEET_POLL_SLOW_MS,
} from "../../../lib/features/flowsheet/constants";
import { FlowsheetPage } from "../../pages/flowsheet.page";
import { ensureOffAirInFreshContext } from "../../helpers/flowsheet-cleanup";
import { getSSEIndicator, waitForSSEConnected } from "../../helpers/sse-wait";

const authDir = path.join(__dirname, "..", "..", ".auth");
const DJ_STORAGE = path.join(authDir, "dj2.json");

/**
 * 90s is the window the issue spec calls for. It comfortably exceeds
 * FLOWSHEET_POLL_FAST_MS (60s — scenario B expects ≥1 poll) and stays well
 * under FLOWSHEET_POLL_SLOW_MS (300s — scenario A expects 0 polls), so both
 * assertions have inequality slack instead of boundary-case races.
 */
const POLL_WINDOW_MS = 90_000;
if (POLL_WINDOW_MS <= FLOWSHEET_POLL_FAST_MS || POLL_WINDOW_MS >= FLOWSHEET_POLL_SLOW_MS) {
  throw new Error(
    `POLL_WINDOW_MS (${POLL_WINDOW_MS}) must be > FLOWSHEET_POLL_FAST_MS (${FLOWSHEET_POLL_FAST_MS}) and < FLOWSHEET_POLL_SLOW_MS (${FLOWSHEET_POLL_SLOW_MS})`
  );
}

/**
 * Match the two `/flowsheet/*` endpoints whose pollingInterval is governed
 * by `useFlowsheetPollingInterval`. Deliberately excludes
 * `/flowsheet/djs-on-air`, which is a separate query on a fixed 60s interval
 * not tied to SSE state — counting it here would mask the SSE slowdown.
 */
const FLOWSHEET_POLL_RE = /\/flowsheet\/(latest\b|\?page=)/;

/**
 * SSE Tier 2 — polling rate. Pins the SSE-connected slowdown of the safety
 * poll: `useFlowsheetPollingInterval` returns FLOWSHEET_POLL_SLOW_MS when
 * connected and FLOWSHEET_POLL_FAST_MS otherwise. A regression here
 * re-introduces duplicate work and inflates Backend-Service traffic.
 *
 * Strategy: capture every `/flowsheet/(latest|?page=…)` GET via
 * `page.on("request")`, settle the initial RTK Query fetches, then count
 * NEW requests during a POLL_WINDOW_MS window. With SLOW the next poll is
 * well past the window's right edge (expect 0). With FAST the next poll
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
    await ensureOffAirInFreshContext(browser, DJ_STORAGE);
  });

  test("SSE connected: zero /flowsheet polls in the window (slow cadence)", async ({
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

  test("SSE blocked: at least one /flowsheet poll in the window (fast cadence)", async ({
    page,
  }) => {
    await page.route("**/events/stream*", (route) => route.abort());

    const fs = new FlowsheetPage(page);
    await fs.goto();
    await fs.waitForEntriesLoaded();

    await expect(getSSEIndicator(page)).not.toHaveAttribute("data-status", "connected", {
      timeout: 5_000,
    });

    const pollCount = await countFlowsheetPolls(page, POLL_WINDOW_MS);
    expect(pollCount).toBeGreaterThanOrEqual(1);
  });
});

/**
 * Wait for the page to settle (initial flowsheet GETs landed), then count
 * matching GET requests for `windowMs`. Returns the post-settle count.
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
