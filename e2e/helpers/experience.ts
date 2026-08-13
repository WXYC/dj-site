import { expect, type BrowserContext } from "@playwright/test";

import { APP_SKIN_STORAGE_KEY } from "../../lib/features/experiences/preferences";
import type {
  ColorMode,
  ExperienceId,
} from "../../lib/features/experiences/types";

/**
 * Moves an already-authenticated context to the given experience.
 *
 * Every stored auth state is produced by logging in, which lands on the app's
 * default experience — modern. Without this, a spec that navigates to a classic
 * URL renders the *modern* slot's fallback and passes for the wrong reason.
 *
 * **Setting the `app_state` cookie alone does not work**, which is worth stating
 * because it is the obvious approach. The app resolves the active experience in
 * priority order — the account's `appSkin` field, then localStorage, then the
 * cookie — and the client-side preference sync re-persists whichever source wins
 * on every page load, hard-reloading the tab when the resolved experience
 * differs from the one the server painted. A cookie-only switch therefore
 * survives exactly one render: SSR paints classic, the sync resolves modern from
 * localStorage, rewrites the cookie, and reloads back into modern.
 *
 * So both are set, at the two levels that decide the outcome:
 *
 * - **localStorage**, via an init script, so it is in place before app code runs
 *   on every navigation and the sync resolves the experience under test. The
 *   account field is deliberately left alone — it is shared server state, and
 *   writing it would leak this preference into any spec using the same seeded
 *   user in a concurrent worker.
 * - **the cookie**, so the first navigation already server-renders the right
 *   slot instead of painting the wrong one and paying a reload.
 */
export async function setExperience(
  context: BrowserContext,
  experience: ExperienceId,
  baseURL: string,
  colorMode: ColorMode = "light"
): Promise<void> {
  // Classic has no theme axis, so its preference is the two-part form.
  const preference =
    experience === "classic"
      ? `classic-${colorMode}`
      : `modern-default-${colorMode}`;

  await context.addInitScript(
    ([key, value]) => {
      window.localStorage.setItem(key, value);
    },
    [APP_SKIN_STORAGE_KEY, preference]
  );

  const response = await context.request.post(
    `${baseURL}/api/experiences/switch`,
    {
      data: { experience },
      // The route rejects any request whose Origin doesn't match the served
      // host, and request.post sends neither Origin nor Referer on its own.
      headers: { origin: baseURL, referer: `${baseURL}/dashboard` },
    }
  );

  // A silent failure here surfaces much later as "the classic assertion failed",
  // pointing at the page instead of at the switch.
  expect(
    response.ok(),
    `switching to the ${experience} experience failed: ${response.status()}`
  ).toBe(true);
}

/** Convenience wrapper for the common case. */
export async function useClassicExperience(
  context: BrowserContext,
  baseURL: string
): Promise<void> {
  await setExperience(context, "classic", baseURL);
}
