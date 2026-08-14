import type { BrowserContext, Page } from "@playwright/test";

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

/**
 * Authenticated counterpart to {@link setExperienceCookie}.
 *
 * A signed-in context can't be moved by the cookie (see that function's
 * doc), because `createServerSideProps` overwrites it with the account's
 * `appSkin` field whenever a session resolves. The only lever a signed-in
 * context actually reads is that account field, so this pulls it — but
 * through the app's own "switch experience" control (the button
 * `ExperienceGap` renders, wired to `useExperienceSwitch`, which calls
 * `authClient.updateUser({ appSkin })`) rather than writing the field
 * directly. That keeps this helper honest about what a real user flow does,
 * and avoids predicting an internal endpoint shape it doesn't own.
 *
 * `gapURL` must be a route the *current* experience's slot has no page for,
 * so the target experience's `ExperienceGap` renders and offers the switch
 * button — e.g. `/dashboard/help` is classic-only, so it works for
 * `target: "classic"` from a modern account; a modern-only admin route (the
 * signed-in account needs a role that can reach it) works for
 * `target: "modern"` from a classic account.
 *
 * Idempotent: a no-op when the account is already on `target`. Mutates
 * shared server state on the signed-in account, so only call this against a
 * dedicated identity no other spec observes.
 */
export async function setExperienceViaAccount(
  page: Page,
  target: ExperienceId,
  gapURL: string
): Promise<void> {
  await page.goto(gapURL);

  const targetContainer = page.locator(
    target === "classic" ? "#classic-container" : "#modern-container"
  );
  if (await targetContainer.isVisible({ timeout: 5000 }).catch(() => false)) {
    return;
  }

  const switchButton = page.getByRole("button", {
    name:
      target === "classic"
        ? /switch to the classic interface/i
        : /switch to the modern interface/i,
  });
  await switchButton.waitFor({ state: "visible", timeout: 15000 });
  await switchButton.click();
  await targetContainer.waitFor({ state: "visible", timeout: 15000 });
}
