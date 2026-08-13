import { expect, type BrowserContext } from "@playwright/test";

import type { ExperienceId } from "../../lib/features/experiences/types";

/**
 * Moves an already-authenticated context to the given experience.
 *
 * Every stored auth state is produced by logging in, which lands on the app's
 * default experience — modern. Without this, a spec that navigates to a classic
 * URL renders the *modern* slot's fallback and passes for the wrong reason.
 *
 * This drives the app's own switch endpoint rather than writing the `app_state`
 * cookie directly. Hand-setting it has to reproduce the exact domain, path, and
 * value encoding the server wrote; a near-miss (a domain cookie alongside the
 * original host-only one) leaves two `app_state` entries and the server reads
 * whichever it sees first, which fails silently and intermittently. Going
 * through the endpoint also keeps the helper correct if the cookie's shape
 * changes.
 *
 * `context.request` shares the context's cookie jar, so the session cookie goes
 * out and the refreshed `app_state` comes back to the same browser context. The
 * endpoint rejects any request whose Origin doesn't match the served host, so
 * both headers are set explicitly — `request.post` sends neither on its own.
 */
export async function setExperience(
  context: BrowserContext,
  experience: ExperienceId,
  baseURL: string
): Promise<void> {
  const response = await context.request.post(
    `${baseURL}/api/experiences/switch`,
    {
      data: { experience },
      headers: { origin: baseURL, referer: `${baseURL}/dashboard` },
    }
  );

  // A silent 403 here would surface much later as "the classic assertion failed",
  // pointing at the page instead of at the switch.
  expect(
    response.ok(),
    `switching to the ${experience} experience failed: ${response.status()} ${await response
      .text()
      .catch(() => "")}`
  ).toBe(true);
}

/** Convenience wrapper for the common case. */
export async function useClassicExperience(
  context: BrowserContext,
  baseURL: string
): Promise<void> {
  await setExperience(context, "classic", baseURL);
}
