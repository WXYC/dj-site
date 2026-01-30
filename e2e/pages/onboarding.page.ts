import { Page, Locator, expect } from "@playwright/test";

/**
 * Page Object Model for the Onboarding/New User Page
 */
export class OnboardingPage {
  readonly page: Page;

  // Form elements
  readonly realNameInput: Locator;
  readonly djNameInput: Locator;
  readonly passwordInput: Locator;
  readonly confirmPasswordInput: Locator;
  readonly submitButton: Locator;
  readonly backButton: Locator;

  // Messages
  readonly passwordHelperText: Locator;
  readonly errorToast: Locator;
  readonly successToast: Locator;

  // Quotes/Header
  readonly pageQuote: Locator;

  constructor(page: Page) {
    this.page = page;

    // Form inputs
    this.realNameInput = page.locator('input[name="realName"]');
    this.djNameInput = page.locator('input[name="djName"]');
    this.passwordInput = page.locator('input[name="password"]');
    this.confirmPasswordInput = page.locator('input[name="confirmPassword"]');
    this.submitButton = page.locator('button[type="submit"]');
    this.backButton = page.locator('button:has-text("Login with a different account")');

    // Helper text
    this.passwordHelperText = page.locator('text=Must be at least 8 characters');

    // Toasts
    this.errorToast = page.locator('[data-sonner-toast][data-type="error"]');
    this.successToast = page.locator('[data-sonner-toast][data-type="success"]');

    // Page elements
    this.pageQuote = page.locator('[data-testid="quote"], .quote');
  }

  async waitForPage(): Promise<void> {
    await this.realNameInput.waitFor({ state: "visible", timeout: 10000 });
  }

  async fillOnboardingForm(data: {
    realName: string;
    djName: string;
    password: string;
    confirmPassword?: string;
  }): Promise<void> {
    await this.realNameInput.fill(data.realName);
    await this.djNameInput.fill(data.djName);
    await this.passwordInput.fill(data.password);
    await this.confirmPasswordInput.fill(data.confirmPassword || data.password);
  }

  async submitForm(): Promise<void> {
    await this.submitButton.click();
  }

  async completeOnboarding(data: {
    realName: string;
    djName: string;
    password: string;
    confirmPassword?: string;
  }): Promise<void> {
    await this.fillOnboardingForm(data);
    await this.submitForm();
  }

  async goBackToLogin(): Promise<void> {
    await this.backButton.click();
    await this.page.waitForURL("**/login**");
  }

  async expectFormVisible(): Promise<void> {
    await expect(this.realNameInput).toBeVisible();
    await expect(this.djNameInput).toBeVisible();
    await expect(this.passwordInput).toBeVisible();
    await expect(this.confirmPasswordInput).toBeVisible();
  }

  async expectSubmitButtonDisabled(): Promise<void> {
    await expect(this.submitButton).toBeDisabled();
  }

  async expectSubmitButtonEnabled(): Promise<void> {
    await expect(this.submitButton).toBeEnabled();
  }

  async expectErrorToast(message?: string): Promise<void> {
    await expect(this.errorToast).toBeVisible({ timeout: 5000 });
    if (message) {
      await expect(this.errorToast).toContainText(message);
    }
  }

  async expectSuccessToast(message?: string): Promise<void> {
    await expect(this.successToast).toBeVisible({ timeout: 5000 });
    if (message) {
      await expect(this.successToast).toContainText(message);
    }
  }

  async expectRedirectToDashboard(): Promise<void> {
    await this.page.waitForURL("**/dashboard/**", { timeout: 10000 });
  }

  async expectPasswordHelperVisible(): Promise<void> {
    await expect(this.passwordHelperText).toBeVisible();
  }

  async isOnOnboardingPage(): Promise<boolean> {
    const url = this.page.url();
    return url.includes("/newuser") || url.includes("/onboarding");
  }

  /**
   * Fill only specific required fields
   */
  async fillRequiredField(
    field: "realName" | "djName" | "password" | "confirmPassword",
    value: string
  ): Promise<void> {
    const inputMap = {
      realName: this.realNameInput,
      djName: this.djNameInput,
      password: this.passwordInput,
      confirmPassword: this.confirmPasswordInput,
    };
    await inputMap[field].fill(value);
  }

  /**
   * Check if a field shows validation success (green color)
   */
  async expectFieldValid(field: "realName" | "djName" | "password" | "confirmPassword"): Promise<void> {
    const inputMap = {
      realName: this.realNameInput,
      djName: this.djNameInput,
      password: this.passwordInput,
      confirmPassword: this.confirmPasswordInput,
    };
    // MUI Joy uses color="success" for valid fields
    await expect(inputMap[field]).toHaveAttribute("class", /success/);
  }
}
