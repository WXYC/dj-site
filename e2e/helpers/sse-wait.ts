import { expect, Page } from "@playwright/test";

/**
 * Block until the page's SSEConnectionIndicator dot reports `connected`.
 *
 * Mounted on the modern dashboard (app/dashboard/@modern/flowsheet/layout.tsx)
 * — exposes `data-status` matching the values from `LiveUpdatesConnectionStatus`:
 * `closed | connecting | connected | reconnecting`. Wait on the attribute
 * rather than `data-state="connected"` selectors because Playwright's
 * attribute assertions retry until the timeout.
 *
 * Use this in dashboard tests where firing `pgNotify` before the handshake
 * completes would lose the message (LISTEN/NOTIFY has no replay).
 */
export async function waitForSSEConnected(page: Page, timeoutMs = 10_000): Promise<void> {
  const indicator = page.locator('[data-status]').first();
  await expect(indicator).toHaveAttribute("data-status", "connected", { timeout: timeoutMs });
}

/**
 * Wait for the GET /events/stream request to fire and the response to land
 * with `text/event-stream`. Use on surfaces that don't mount the dashboard
 * indicator (e.g., the public `/live` page).
 *
 * Returns the response so callers can introspect headers/status if they
 * want (test #2 asserts the content-type, for example).
 */
export async function waitForSSEHandshake(page: Page, timeoutMs = 10_000) {
  return page.waitForResponse(
    (resp) => resp.url().includes("/events/stream") && resp.status() === 200,
    { timeout: timeoutMs }
  );
}
