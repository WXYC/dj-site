import { expect, Locator, Page } from "@playwright/test";
import type { LiveUpdatesConnectionStatus } from "../../lib/features/flowsheet/live-updates-slice";

/**
 * Locator for the SSEConnectionIndicator dot (src/components/shared/
 * SSEConnectionIndicator.tsx). Selecting on the aria-label prefix scopes to
 * *this* indicator — any future MUI Joy child that grows a `data-status`
 * attribute won't accidentally match.
 */
export function getSSEIndicator(page: Page): Locator {
  return page.locator('[aria-label^="Live updates:"][data-status]');
}

/**
 * Block until the indicator's `data-status` matches `status`. Use in
 * dashboard tests where firing `pgNotify` before the handshake completes
 * would lose the message (LISTEN/NOTIFY has no replay).
 */
export async function waitForSSEStatus(
  page: Page,
  status: LiveUpdatesConnectionStatus,
  timeoutMs = 10_000
): Promise<void> {
  await expect(getSSEIndicator(page)).toHaveAttribute("data-status", status, {
    timeout: timeoutMs,
  });
}

export async function waitForSSEConnected(page: Page, timeoutMs = 10_000): Promise<void> {
  await waitForSSEStatus(page, "connected", timeoutMs);
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
