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

  // Feedback elements
  readonly errorToast: Locator;
  readonly successToast: Locator;
  readonly alertMessage: Locator;

  constructor(page: Page) {
    this.page = page;

    // Login form
    this.usernameInput = page.locator('input[name="username"]');
    this.passwordInput = page.locator('input[name="password"]');
    this.submitButton = page.locator('button[type="submit"]');
    this.forgotPasswordLink = page.locator('button:has-text("Forgot?"), a:has-text("Forgot?")');

    // Password reset form
    this.emailInput = page.locator('input[name="email"]');
    this.sendResetLinkButton = page.locator('button:has-text("Send Reset Link")');
    this.newPasswordInput = page.locator('input[name="password"]');
    this.confirmPasswordInput = page.locator('input[name="confirmPassword"]');
    this.backButton = page.locator('button:has-text("Never mind"), button:has-text("Login with a different account")');

    // Feedback - sonner toast notifications
    this.errorToast = page.locator('[data-sonner-toast][data-type="error"]');
    this.successToast = page.locator('[data-sonner-toast][data-type="success"]');
    this.alertMessage = page.locator('[role="alert"]');
  }

  async goto(): Promise<void> {
    await this.page.goto("/login");
    await this.page.waitForLoadState("networkidle");
  }

  async gotoWithToken(token: string): Promise<void> {
    await this.page.goto(`/login?token=${encodeURIComponent(token)}`);
    await this.page.waitForLoadState("networkidle");
    // Wait for the reset form to appear (state change from useEffect)
    await this.newPasswordInput.waitFor({ state: "visible", timeout: 5000 });
  }

  async gotoWithError(error: string): Promise<void> {
    await this.page.goto(`/login?error=${encodeURIComponent(error)}`);
    await this.page.waitForLoadState("networkidle");
    // Wait for the alert to appear (state change from useEffect)
    await this.alertMessage.waitFor({ state: "visible", timeout: 5000 });
  }

  async login(username: string, password: string): Promise<void> {
    await this.usernameInput.fill(username);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
  }

  async clickForgotPassword(): Promise<void> {
    await this.forgotPasswordLink.click();
    // Wait for the password reset form to appear (state change)
    await this.emailInput.waitFor({ state: "visible", timeout: 5000 });
  }

  async requestPasswordReset(email: string): Promise<void> {
    await this.emailInput.fill(email);
    await this.sendResetLinkButton.click();
  }

  async resetPassword(newPassword: string, confirmPassword: string): Promise<void> {
    await this.newPasswordInput.fill(newPassword);
    await this.confirmPasswordInput.fill(confirmPassword);
    await this.submitButton.click();
  }

  async goBackToLogin(): Promise<void> {
    await this.backButton.click();
  }

  async expectLoginFormVisible(): Promise<void> {
    await expect(this.usernameInput).toBeVisible();
    await expect(this.passwordInput).toBeVisible();
    await expect(this.submitButton).toBeVisible();
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
      await expect(specificToast).toBeVisible({ timeout: 5000 });
    } else {
      await expect(this.successToast).toBeVisible({ timeout: 5000 });
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
    // Onboarding might be on a different route
    await this.page.waitForURL((url) => {
      const path = url.pathname;
      return path.includes("/newuser") || path.includes("/onboarding");
    }, { timeout: 10000 });
  }
}
