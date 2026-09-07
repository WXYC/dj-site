import { Page, Locator, expect } from "@playwright/test";

/**
 * The plaintext code a rotate returned, paired with its passcode row id. The
 * id is captured from the rotate response so teardown can revoke exactly the
 * row this run minted.
 */
export type RotatedPasscode = { id: string; code: string };

/** The account details the DJ-facing signup form collects. */
export type SignupDetails = {
  passcode: string;
  username: string;
  email: string;
  password: string;
  realName: string;
  djName?: string;
};

/**
 * Page Object Model for the two station self-signup surfaces:
 *
 *  - the STATION MANAGER passcode panel (StationSignupPanel), reached through
 *    the roster page's "Signup Passcode" segment — rotate mints a code and
 *    reveals its plaintext once; and
 *  - the DJ-FACING signup form (StationSignupForm), reached from the "Sign up
 *    here" link on the login form — a passcode gate, then account details.
 *
 * Both are gated: the panel requires a `stationManager` session, the form
 * requires the `NEXT_PUBLIC_STATION_SIGNUP_ENABLED` build flag for its entry
 * link and `STATION_SIGNUP_ENABLED` on the auth service for the POST to
 * resolve. The spec drives one instance per browser context accordingly.
 */
export class StationSignupPage {
  readonly page: Page;

  // --- Manager passcode panel (on the roster page) ---
  readonly passcodeViewToggle: Locator;
  readonly panel: Locator;
  readonly rotateButton: Locator;
  readonly revealButton: Locator;

  // --- DJ-facing signup form (on the login page) ---
  readonly signupLink: Locator;
  readonly passcodeInput: Locator;
  readonly passcodeContinueButton: Locator;
  readonly usernameInput: Locator;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly realNameInput: Locator;
  readonly djNameInput: Locator;
  readonly detailsSubmitButton: Locator;
  readonly successAlert: Locator;
  readonly detailsError: Locator;
  readonly unavailableAlert: Locator;
  readonly cooldownAlert: Locator;

  constructor(page: Page) {
    this.page = page;

    // Manager panel. The roster page's segmented control (RosterViewSwitcher)
    // renders the panel only under its "Signup Passcode" segment.
    this.passcodeViewToggle = page.getByRole("button", { name: "Signup Passcode" });
    this.panel = page.getByTestId("station-signup-panel");
    this.rotateButton = this.panel.getByRole("button", { name: "Rotate" });
    this.revealButton = this.panel.getByRole("button", { name: "Reveal" });

    // DJ-facing form. `Input name="…"` renders a native input with that name;
    // the Continue/Submit buttons are `type="submit"` with visible copy.
    this.signupLink = page.getByRole("button", { name: "Sign up here" });
    this.passcodeInput = page.locator('input[name="passcode"]');
    this.passcodeContinueButton = page.getByRole("button", { name: "Continue" });
    this.usernameInput = page.locator('input[name="username"]');
    this.emailInput = page.locator('input[name="email"]');
    this.passwordInput = page.locator('input[name="password"]');
    this.realNameInput = page.locator('input[name="realName"]');
    this.djNameInput = page.locator('input[name="djName"]');
    this.detailsSubmitButton = page.locator('button[type="submit"]:has-text("Submit")');
    this.successAlert = page.getByTestId("signup-success");
    this.detailsError = page.getByTestId("signup-details-error");
    this.unavailableAlert = page.getByTestId("signup-unavailable");
    this.cooldownAlert = page.getByTestId("signup-cooldown");
  }

  // ---------------------------------------------------------------------------
  // Manager passcode panel
  // ---------------------------------------------------------------------------

  /**
   * Open the station-signup passcode panel on the roster page. Navigates to the
   * roster and switches the segmented control to "Signup Passcode", which is
   * what mounts the panel (and starts its status poll).
   */
  async openPasscodePanel(): Promise<void> {
    await this.page.goto("/dashboard/admin/roster");
    await this.page.waitForURL("**/dashboard/admin/roster**", { timeout: 10000 });
    await this.passcodeViewToggle.waitFor({ state: "visible", timeout: 15000 });
    // The toggle is a client onClick: a click landing before hydration
    // attaches the handler is a silent no-op. Retry until the panel mounts.
    await expect(async () => {
      await this.passcodeViewToggle.click();
      await this.panel.waitFor({ state: "visible", timeout: 1500 });
    }).toPass({ timeout: 15000 });
  }

  /**
   * Rotate the station passcode from the panel, returning its plaintext and id.
   *
   * The id is read from the `/admin/station-signup/rotate` response — the
   * panel renders only the code, so the response is the sole source of the row
   * id teardown revokes against. The revealed plaintext is also asserted
   * visible, so this exercises the real reveal-on-rotate UI, not just the API.
   */
  async rotatePasscode(): Promise<RotatedPasscode> {
    await this.openPasscodePanel();

    const rotateResponse = this.page.waitForResponse(
      (r) =>
        /\/admin\/station-signup\/rotate\b/.test(r.url()) &&
        r.request().method() === "POST" &&
        r.status() === 200,
      { timeout: 20000 }
    );
    void rotateResponse.catch(() => {});

    await expect(this.rotateButton).toBeEnabled({ timeout: 10000 });
    await this.rotateButton.click();

    const parsed = (await (await rotateResponse).json()) as { id?: string; code?: string };
    expect(typeof parsed.id).toBe("string");
    expect(typeof parsed.code).toBe("string");
    const rotated: RotatedPasscode = { id: parsed.id as string, code: parsed.code as string };

    // The plaintext is shown once, in the panel's reveal alert — confirm the
    // UI surfaced exactly the code the response returned.
    await expect(this.panel.getByText(rotated.code, { exact: true })).toBeVisible({ timeout: 10000 });

    return rotated;
  }

  // ---------------------------------------------------------------------------
  // DJ-facing signup form
  // ---------------------------------------------------------------------------

  /**
   * From a fresh login page, open the station-signup form via its "Sign up
   * here" link and wait for the passcode step. The link is a client onClick
   * (dispatches the signup auth stage), so the click is retried until the
   * passcode input renders.
   */
  async gotoSignupForm(): Promise<void> {
    await this.page.goto("/login");
    await this.page.waitForLoadState("load");
    await this.signupLink.waitFor({ state: "visible", timeout: 15000 });
    await expect(async () => {
      await this.signupLink.click();
      await this.passcodeInput.waitFor({ state: "visible", timeout: 1500 });
    }).toPass({ timeout: 15000 });
  }

  /** Enter the passcode and advance to the account-details step. */
  async submitPasscode(passcode: string): Promise<void> {
    await this.passcodeInput.fill(passcode);
    await expect(this.passcodeContinueButton).toBeEnabled({ timeout: 5000 });
    await this.passcodeContinueButton.click();
    await this.usernameInput.waitFor({ state: "visible", timeout: 10000 });
  }

  /** Fill the account-details step. */
  async fillDetails(details: SignupDetails): Promise<void> {
    await this.usernameInput.fill(details.username);
    await this.emailInput.fill(details.email);
    await this.passwordInput.fill(details.password);
    await this.realNameInput.fill(details.realName);
    if (details.djName) {
      await this.djNameInput.fill(details.djName);
    }
  }

  /** Submit the account-details step (the passcode + details POST). */
  async submitDetails(): Promise<void> {
    await expect(this.detailsSubmitButton).toBeEnabled({ timeout: 10000 });
    await this.detailsSubmitButton.click();
  }

  /**
   * Walk the whole DJ signup flow: open the form, clear the passcode gate,
   * fill the details, and submit.
   */
  async signUp(details: SignupDetails): Promise<void> {
    await this.gotoSignupForm();
    await this.submitPasscode(details.passcode);
    await this.fillDetails(details);
    await this.submitDetails();
  }

  /**
   * Assert the terminal success state: the account was created and names the
   * username the DJ chose.
   */
  async expectSignupSuccess(username: string): Promise<void> {
    await expect(this.successAlert).toBeVisible({ timeout: 15000 });
    await expect(this.successAlert).toContainText(username);
  }
}
