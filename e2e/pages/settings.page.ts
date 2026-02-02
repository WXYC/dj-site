import { Page, Locator, expect } from "@playwright/test";

/**
 * Page Object Model for the Settings Popup/Modal
 */
export class SettingsPage {
  readonly page: Page;

  // Settings popup elements
  readonly settingsModal: Locator;
  readonly usernameInput: Locator;
  readonly realNameInput: Locator;
  readonly djNameInput: Locator;
  readonly emailInput: Locator;
  readonly emailChangeButton: Locator;
  readonly saveButton: Locator;

  // Email Change Modal elements
  readonly emailChangeModal: Locator;
  readonly currentEmailInput: Locator;
  readonly newEmailInput: Locator;
  readonly passwordInput: Locator;
  readonly sendVerificationButton: Locator;
  readonly cancelButton: Locator;
  readonly doneButton: Locator;

  // Success state elements
  readonly successTitle: Locator;
  readonly verificationSentMessage: Locator;

  // Toast notifications
  readonly successToast: Locator;
  readonly errorToast: Locator;

  // Error messages
  readonly errorMessage: Locator;

  constructor(page: Page) {
    this.page = page;

    // Settings popup - it's a Card inside a Modal
    this.settingsModal = page.locator('[role="dialog"]:has-text("Your Information")');
    this.usernameInput = this.settingsModal.locator('input').first();
    this.realNameInput = this.settingsModal.locator('input[name="realName"]');
    this.djNameInput = this.settingsModal.locator('input[name="djName"]');
    this.emailInput = this.settingsModal.locator('input').filter({ hasText: /@/ }).first();
    this.emailChangeButton = this.settingsModal.locator('button:has(svg)').filter({
      has: page.locator('[data-testid="EditIcon"]'),
    });
    this.saveButton = this.settingsModal.locator('button:has-text("Save")');

    // Email Change Modal - nested modal
    this.emailChangeModal = page.locator('[role="dialog"]:has-text("Change Email Address")');
    this.currentEmailInput = this.emailChangeModal.locator('input').first();
    this.newEmailInput = this.emailChangeModal.getByPlaceholder("Enter your new email");
    this.passwordInput = this.emailChangeModal.getByPlaceholder("Confirm your password");
    this.sendVerificationButton = this.emailChangeModal.locator(
      'button:has-text("Send Verification Email")'
    );
    this.cancelButton = this.emailChangeModal.locator('button:has-text("Cancel")');
    this.doneButton = this.emailChangeModal.locator('button:has-text("Done")');

    // Success state
    this.successTitle = this.emailChangeModal.locator('text=Check Your Inbox');
    this.verificationSentMessage = this.emailChangeModal.locator(
      "text=We've sent a verification email to:"
    );

    // Toasts
    this.successToast = page.locator('[data-sonner-toast][data-type="success"]');
    this.errorToast = page.locator('[data-sonner-toast][data-type="error"]');

    // Error messages in the form
    this.errorMessage = this.emailChangeModal.locator('[class*="danger"], [color="danger"]');
  }

  async goto(): Promise<void> {
    await this.page.goto("/dashboard/settings");
    await this.page.waitForLoadState("domcontentloaded");
    await this.settingsModal.waitFor({ state: "visible", timeout: 10000 });
  }

  async openEmailChangeModal(): Promise<void> {
    // Find the edit button next to the email field
    // It's an IconButton with an Edit icon
    const emailRow = this.settingsModal.locator('label:has-text("Email")').locator("..");
    const editButton = emailRow.locator("button");
    await editButton.click();
    await this.emailChangeModal.waitFor({ state: "visible", timeout: 5000 });
  }

  async fillEmailChangeForm(newEmail: string, password: string): Promise<void> {
    await this.newEmailInput.fill(newEmail);
    await this.passwordInput.fill(password);
  }

  async submitEmailChange(): Promise<void> {
    await this.sendVerificationButton.click();
  }

  async changeEmail(newEmail: string, password: string): Promise<void> {
    await this.openEmailChangeModal();
    await this.fillEmailChangeForm(newEmail, password);
    await this.submitEmailChange();
  }

  async cancelEmailChange(): Promise<void> {
    await this.cancelButton.click();
  }

  async closeSuccessModal(): Promise<void> {
    await this.doneButton.click();
  }

  async expectEmailChangeModalVisible(): Promise<void> {
    await expect(this.emailChangeModal).toBeVisible();
  }

  async expectEmailChangeModalHidden(): Promise<void> {
    await expect(this.emailChangeModal).not.toBeVisible();
  }

  async expectSuccessState(): Promise<void> {
    await expect(this.successTitle).toBeVisible({ timeout: 10000 });
    await expect(this.verificationSentMessage).toBeVisible();
  }

  async expectErrorMessage(message: string): Promise<void> {
    const errorText = this.emailChangeModal.getByText(message);
    await expect(errorText).toBeVisible({ timeout: 5000 });
  }

  async expectSuccessToast(message?: string): Promise<void> {
    if (message) {
      const specificToast = this.page.locator(
        `[data-sonner-toast][data-type="success"]:has-text("${message}")`
      );
      await expect(specificToast).toBeVisible({ timeout: 10000 });
    } else {
      await expect(this.successToast).toBeVisible({ timeout: 10000 });
    }
  }

  async expectErrorToast(message?: string): Promise<void> {
    if (message) {
      const specificToast = this.page.locator(
        `[data-sonner-toast][data-type="error"]:has-text("${message}")`
      );
      await expect(specificToast).toBeVisible({ timeout: 10000 });
    } else {
      await expect(this.errorToast).toBeVisible({ timeout: 10000 });
    }
  }

  async expectCurrentEmail(email: string): Promise<void> {
    await expect(this.currentEmailInput).toHaveValue(email);
  }

  async expectNewEmailDisplayed(email: string): Promise<void> {
    // In success state, the new email is displayed as text
    const emailText = this.emailChangeModal.getByText(email, { exact: true });
    await expect(emailText).toBeVisible();
  }
}
