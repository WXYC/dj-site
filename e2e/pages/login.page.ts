import { Page, Locator, expect } from "@playwright/test";

/**
 * Page Object Model for the Login Page
 */
export class LoginPage {
  readonly page: Page;

  // Form elements
  readonly usernameInput: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;
  readonly forgotPasswordLink: Locator;

  // Password reset elements
  readonly emailInput: Locator;
  readonly sendResetLinkButton: Locator;
  readonly newPasswordInput: Locator;
  readonly confirmPasswordInput: Locator;
  readonly backButton: Locator;

  // OTP form elements
  readonly otpEmailInput: Locator;
  readonly sendCodeButton: Locator;
  readonly switchToPasswordLink: Locator;

  // Feedback elements
  readonly errorToast: Locator;
  readonly successToast: Locator;
  readonly alertMessage: Locator;

  constructor(page: Page) {
    this.page = page;

    // Login form
    this.usernameInput = page.locator('input[name="username"]');
    this.passwordInput = page.locator('input[name="password"]');
    // Use a specific selector for the Submit button (excluding "Never mind" link which is also type="submit")
    this.submitButton = page.locator('button[type="submit"]:has-text("Submit")');
    this.forgotPasswordLink = page.locator('button:has-text("Forgot?"), a:has-text("Forgot?")');

    // OTP form
    this.otpEmailInput = page.locator('input[name="email"]');
    this.sendCodeButton = page.locator('button:has-text("Send login code")');
    this.switchToPasswordLink = page.getByRole("button", {
      name: "Sign in with password instead",
    });

    // Password reset form
    this.emailInput = page.locator('input[name="email"]');
    this.sendResetLinkButton = page.locator('button:has-text("Send Reset Link")');
    this.newPasswordInput = page.locator('input[name="password"]');
    this.confirmPasswordInput = page.locator('input[name="confirmPassword"]');
    this.backButton = page.locator('button:has-text("Never mind"), button:has-text("Login with a different account")');

    // Feedback - sonner toast notifications
    this.errorToast = page.locator('[data-sonner-toast][data-type="error"]');
    this.successToast = page.locator('[data-sonner-toast][data-type="success"]');
    // MUI Joy Alert component (exclude Next.js route announcer)
    this.alertMessage = page.locator('[role="alert"].MuiAlert-root');
  }

  async goto(): Promise<void> {
    await this.page.goto("/login");
    await this.page.waitForLoadState("load");
  }

  /**
   * Switch from the default OTP email form to the password login form.
   * No-op if the password form is already visible (e.g. when the user's
   * preferred login method was restored from localStorage).
   */
  async switchToPasswordLogin(): Promise<void> {
    if (await this.usernameInput.isVisible()) return;
    await this.switchToPasswordLink.waitFor({ state: "visible", timeout: 15000 });
    // The Redux dispatch from the click can occasionally fail to trigger a
    // re-render on slow CI runners. Retry the click if the form doesn't swap.
    for (let attempt = 0; attempt < 3; attempt++) {
      await this.switchToPasswordLink.click();
      try {
        await this.usernameInput.waitFor({ state: "visible", timeout: 5000 });
        return;
      } catch {
        // Form didn't transition — retry the click
      }
    }
    // Final attempt with a longer timeout to produce a clear error
    await this.usernameInput.waitFor({ state: "visible", timeout: 10000 });
  }

  async gotoWithToken(token: string): Promise<void> {
    await this.page.goto(`/login?token=${encodeURIComponent(token)}`);
    await this.page.waitForLoadState("domcontentloaded");
    // Wait for the reset form to appear (state change from useEffect)
    await this.newPasswordInput.waitFor({ state: "visible", timeout: 5000 });
  }

  async gotoWithError(error: string): Promise<void> {
    await this.page.goto(`/login?error=${encodeURIComponent(error)}`);
    await this.page.waitForLoadState("domcontentloaded");
    // Wait for the alert to appear (state change from useEffect)
    await this.alertMessage.waitFor({ state: "visible", timeout: 5000 });
  }

  async login(username: string, password: string): Promise<void> {
    // If the password form isn't visible yet, switch from OTP to password login
    if (!(await this.usernameInput.isVisible())) {
      await this.switchToPasswordLogin();
    }
    await this.usernameInput.fill(username);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
  }

  async clickForgotPassword(): Promise<void> {
    // Forgot password link is on the password form -- switch if needed
    if (!(await this.forgotPasswordLink.isVisible())) {
      await this.switchToPasswordLogin();
    }
    await this.forgotPasswordLink.click();
    // Wait for the password reset form to appear and be interactive.
    // The email input and send button must both be enabled, confirming
    // React hydration is complete and no stale requestingReset state.
    await this.emailInput.waitFor({ state: "visible", timeout: 5000 });
    await expect(this.emailInput).toBeEnabled({ timeout: 5000 });
    await expect(this.sendResetLinkButton).toBeVisible({ timeout: 5000 });
  }

  async requestPasswordReset(email: string): Promise<void> {
    await this.emailInput.fill(email);
    await expect(this.sendResetLinkButton).toBeEnabled({ timeout: 10000 });
    await this.sendResetLinkButton.click();
  }

  async resetPassword(newPassword: string, confirmPassword: string): Promise<void> {
    await this.newPasswordInput.fill(newPassword);
    await this.confirmPasswordInput.fill(confirmPassword);
    await expect(this.submitButton).toBeEnabled({ timeout: 5000 });
    await this.submitButton.click();
  }

  async fillPasswordFields(newPassword: string, confirmPassword: string): Promise<void> {
    await this.newPasswordInput.fill(newPassword);
    await this.confirmPasswordInput.fill(confirmPassword);
    // Wait for validation to process
    await this.page.waitForTimeout(500);
  }

  async goBackToLogin(): Promise<void> {
    await this.backButton.click();
  }

  async expectLoginFormVisible(): Promise<void> {
    // The login page may show the OTP form or password form depending on state.
    // Wait for either the username input or the OTP email input to appear.
    await expect(this.usernameInput.or(this.otpEmailInput)).toBeVisible();
  }

  async expectPasswordResetFormVisible(): Promise<void> {
    await expect(this.emailInput).toBeVisible();
    await expect(this.sendResetLinkButton).toBeVisible();
  }

  async expectNewPasswordFormVisible(): Promise<void> {
    await expect(this.newPasswordInput).toBeVisible();
    await expect(this.confirmPasswordInput).toBeVisible();
  }

  async expectErrorToast(message?: string): Promise<void> {
    if (message) {
      const specificToast = this.page.locator(`[data-sonner-toast][data-type="error"]:has-text("${message}")`);
      await expect(specificToast).toBeVisible({ timeout: 5000 });
    } else {
      await expect(this.errorToast).toBeVisible({ timeout: 5000 });
    }
  }

  async expectSuccessToast(message?: string): Promise<void> {
    if (message) {
      const specificToast = this.page.locator(`[data-sonner-toast][data-type="success"]:has-text("${message}")`);
      await expect(specificToast).toBeVisible({ timeout: 10000 });
    } else {
      await expect(this.successToast).toBeVisible({ timeout: 10000 });
    }
  }

  async expectSubmitButtonDisabled(): Promise<void> {
    await expect(this.submitButton).toBeDisabled();
  }

  async expectSubmitButtonEnabled(): Promise<void> {
    await expect(this.submitButton).toBeEnabled();
  }

  async isOnLoginPage(): Promise<boolean> {
    return this.page.url().includes("/login");
  }

  async waitForRedirectToDashboard(): Promise<void> {
    await this.page.waitForURL("**/dashboard/**", { timeout: 10000 });
  }

  async waitForRedirectToOnboarding(): Promise<void> {
    // Incomplete users stay on /login where LoginSlotSwitcher renders the
    // newuser slot, or may be on a dedicated /newuser or /onboarding route
    await this.page.waitForURL((url) => {
      const path = url.pathname;
      const search = url.search;
      return path.includes("/newuser") || path.includes("/onboarding") ||
        (path.includes("/login") && search.includes("incomplete=true"));
    }, { timeout: 10000 });
  }
}
