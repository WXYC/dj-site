import type { BrowserContext } from "@playwright/test";

import { defaultApplicationState } from "../../lib/features/application/types";
import type { ExperienceId } from "../../lib/features/experiences/types";

/**
 * Points a context's `app_state` cookie at the given experience.
 *
 * Only meaningful on an unauthenticated surface. Server-side rendering seeds the
 * experience from this cookie and then, whenever a session resolves, overwrites
 * it with the account's `appSkin` — a NOT NULL column that every seeded user
 * carries a modern value in. So for a signed-in context this call is inert: the
 * account wins on every request, and an assertion against it fails looking like
 * a broken page rather than a preference that never applied. Switching a
 * signed-in context means writing that account field, which is shared server
 * state and races any spec using the same seeded user in another worker.
 */
export async function setExperienceCookie(
  context: BrowserContext,
  experience: ExperienceId,
  baseURL: string
): Promise<void> {
  await context.addCookies([
    {
      name: "app_state",
      value: JSON.stringify({ ...defaultApplicationState, experience }),
      url: baseURL,
    },
  ]);
}
