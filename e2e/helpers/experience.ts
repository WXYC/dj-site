import type { BrowserContext } from "@playwright/test";

import type { ExperienceId } from "../../lib/features/experiences/types";

/**
 * Rewrites the viewer's experience preference on an existing browser context.
 *
 * Every stored auth state is produced by logging in, which lands on the app's
 * default experience — modern. Without this, a spec that navigates to a classic
 * URL renders the *modern* slot's fallback and passes for the wrong reason.
 *
 * Rewriting the cookie is preferred over persisting a parallel set of classic
 * storage states: the states are keyed to the seeded users and revalidated per
 * run, so a second copy of each would double that cost and drift independently.
 *
 * `app_state` is plain JSON (the app reads it with `JSON.parse`) and is
 * `httpOnly`, which the page cannot set for itself but Playwright can. Existing
 * keys are preserved so switching the experience doesn't also reset color mode
 * or the modern theme.
 */
export async function setExperience(
  context: BrowserContext,
  experience: ExperienceId,
  baseURL: string
): Promise<void> {
  const cookies = await context.cookies();
  const existing = cookies.find((cookie) => cookie.name === "app_state");

  let state: Record<string, unknown> = {};
  if (existing?.value) {
    try {
      const parsed = JSON.parse(decodeURIComponent(existing.value));
      if (parsed && typeof parsed === "object") {
        state = parsed as Record<string, unknown>;
      }
    } catch {
      // A malformed cookie is replaced rather than merged: the server falls back
      // to defaults for anything missing, so an empty base is always valid.
    }
  }

  const url = new URL(baseURL);
  await context.addCookies([
    {
      name: "app_state",
      value: JSON.stringify({ ...state, experience }),
      domain: url.hostname,
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
      secure: url.protocol === "https:",
    },
  ]);
}

/** Convenience wrapper for the common case. */
export async function useClassicExperience(
  context: BrowserContext,
  baseURL: string
): Promise<void> {
  await setExperience(context, "classic", baseURL);
}
