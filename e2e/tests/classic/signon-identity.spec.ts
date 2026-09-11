import { expect, test } from "@playwright/test";

import { CLASSIC_DJ_USER, CLASSIC_MD_USER } from "../../fixtures/auth.fixture";
import { setExperienceCookie } from "../../helpers/experience";
import { LoginPage } from "../../pages/login.page";

/**
 * The control-room browser is shared, and a DJ who sits down to a predecessor's
 * open session used to have no way to become themselves from any classic
 * screen: the sign-on form echoes the session's real name into a disabled
 * input, and the nav bar's only session control was an unlabelled "Log Out".
 *
 * Deliberately takes NO storage state. It signs out mid-flow, and burning a
 * shared identity's server-side session breaks every spec running in parallel
 * against it — `e2e/tests/auth/logout.spec.ts` invalidates `dj.json` for
 * exactly this reason, which is why the rest of the suite moved to `dj2.json`.
 * Signing both identities in through the UI mints sessions distinct from the
 * ones their storage-state files hold, so nothing else is disturbed.
 *
 * Both identities carry a classic `appSkin` on the account, which is the only
 * lever a signed-in context reads — the cookie below only decides which form
 * the *unauthenticated* /login renders.
 */
test.describe("Classic sign-on identity", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  // Two full sign-ins plus a sign-out, against a 20s per-test default.
  test.setTimeout(60_000);

  async function signInOnClassicForm(
    page: import("@playwright/test").Page,
    user: { username: string; password: string }
  ): Promise<void> {
    const loginPage = new LoginPage(page);
    // Classic renders username/password directly — it has no OTP picker to
    // click through, so the shared `login` helper (which does) can't drive it.
    await expect(loginPage.classicFormTitle).toBeVisible({ timeout: 15000 });
    await loginPage.usernameInput.fill(user.username);
    await loginPage.passwordInput.fill(user.password);
    await expect(loginPage.submitButton).toBeEnabled({ timeout: 10000 });
    await loginPage.submitButton.click();
    // Await the sign-in, not just the click. `useLogin` confirms the session is
    // visible and then pushes the dashboard, so the URL change is the signal
    // that better-auth's Set-Cookie has landed. Navigating before it does tears
    // the document down mid-POST, and `requireAuth` bounces the next request to
    // /login?bounced=no-session — which surfaces as the caller's name assertion
    // burning its whole timeout, reading as a broken nav bar rather than as a
    // racy spec. Both sign-ins go through here, so both are covered.
    await loginPage.waitForRedirectToDashboard(15000);
  }

  test("names the signed-in DJ, and hands the next one a way in", async ({
    page,
    context,
    baseURL,
  }) => {
    await setExperienceCookie(context, "classic", baseURL!);

    await page.goto("/login");
    await signInOnClassicForm(page, CLASSIC_DJ_USER);

    await page.goto("/dashboard/flowsheet");

    // `StartShow` renders only in the `!live` branch, so its presence IS the
    // off-air state — classic has no live-status indicator to poll, and
    // `FlowsheetPage` is a modern-only page object.
    await expect(
      page.getByRole("button", { name: /sign in as a different dj/i })
    ).toBeVisible({ timeout: 20000 });

    // Scoped to the bar: the same name also renders in the sign-on form's
    // disabled Real Name of DJ input on this screen.
    const identity = page.locator(".nav-identity");
    await expect(identity).toHaveText(CLASSIC_DJ_USER.realName);

    await page
      .getByRole("button", { name: /sign in as a different dj/i })
      .click();

    const loginPage = new LoginPage(page);
    await expect(loginPage.classicFormTitle).toBeVisible({ timeout: 20000 });

    await signInOnClassicForm(page, CLASSIC_MD_USER);
    await page.goto("/dashboard/flowsheet");

    await expect(page.locator(".nav-identity")).toHaveText(
      CLASSIC_MD_USER.realName,
      { timeout: 20000 }
    );
  });
});
