import { expect, Page } from "@playwright/test";

/**
 * Block until the page's SSEConnectionIndicator dot reports `connected`.
 *
 * The indicator (src/components/shared/SSEConnectionIndicator.tsx) renders
 * `aria-label="Live updates: …"` + `data-status` matching the values from
 * `LiveUpdatesConnectionStatus`. Selecting on the aria-label prefix scopes
 * the wait to *this* indicator — any future MUI Joy child that grows a
 * `data-status` attribute won't accidentally match.
 *
 * Use this in dashboard tests where firing `pgNotify` before the handshake
 * completes would lose the message (LISTEN/NOTIFY has no replay).
 */
export async function waitForSSEConnected(page: Page, timeoutMs = 10_000): Promise<void> {
  const indicator = page.locator('[aria-label^="Live updates:"][data-status]');
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
