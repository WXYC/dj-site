import { Page, Locator, expect } from "@playwright/test";

/**
 * Page Object Model for the Settings Panel (rightbar sidebar)
 */
export class SettingsPage {
  readonly page: Page;

  // Settings panel elements (in the rightbar)
  readonly settingsPanel: Locator;
  readonly usernameInput: Locator;
  readonly realNameInput: Locator;
  readonly djNameInput: Locator;
  readonly emailInput: Locator;
  readonly emailChangeButton: Locator;
  readonly saveButton: Locator;

  // Email Change Modal elements (still a real modal)
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

    // Settings panel — in the rightbar sidebar
    this.settingsPanel = page.locator('.SecondSidebar');
    this.usernameInput = this.settingsPanel.locator('input').first();
    this.realNameInput = this.settingsPanel.locator('input[name="realName"]');
    this.djNameInput = this.settingsPanel.locator('input[name="djName"]');
    this.emailInput = this.settingsPanel.locator('input').filter({ hasText: /@/ }).first();
    this.emailChangeButton = this.settingsPanel.locator('button:has(svg)').filter({
      has: page.locator('[data-testid="EditIcon"]'),
    });
    this.saveButton = this.settingsPanel.locator('button:has-text("Save")');

    // Keep backward compat — settingsModal points to the panel
    (this as any).settingsModal = this.settingsPanel;

    // Email Change Modal - still a real modal dialog
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
    // Ensure we're on a dashboard page
    const url = this.page.url();
    if (!url.includes("/dashboard")) {
      await this.page.goto("/dashboard/flowsheet");
      await this.page.waitForLoadState("networkidle");
    }
    // Click the Settings button in the leftbar (icon-only, identified by aria-label)
    const settingsButton = this.page.locator('[aria-label="Settings"]');
    await settingsButton.waitFor({ state: "visible", timeout: 10000 });
    await settingsButton.click({ force: true });
    // Wait for the settings panel content to appear in the rightbar
    await this.settingsPanel.locator('text=Identity').waitFor({ state: "visible", timeout: 10000 });
  }

  async openEmailChangeModal(): Promise<void> {
    const emailRow = this.settingsPanel.locator('label:has-text("Email")').locator("..");
    const editButton = emailRow.locator("button");
    await editButton.click({ force: true });
    await this.emailChangeModal.waitFor({ state: "visible", timeout: 5000 });
  }

  async fillEmailChangeForm(newEmail: string, password: string): Promise<void> {
    await this.newEmailInput.fill(newEmail);
    await this.passwordInput.fill(password);
  }

  async submitEmailChange(): Promise<void> {
    const form = this.emailChangeModal.locator("form");
    await form.evaluate((f) =>
      f.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }))
    );
  }

  async changeEmail(newEmail: string, password: string): Promise<void> {
    await this.openEmailChangeModal();
    await this.fillEmailChangeForm(newEmail, password);
    await this.submitEmailChange();
  }

  async cancelEmailChange(): Promise<void> {
    await this.cancelButton.evaluate((el) => (el as HTMLElement).click());
  }

  async closeSuccessModal(): Promise<void> {
    await this.doneButton.evaluate((el) => (el as HTMLElement).click());
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
    const emailText = this.emailChangeModal.getByText(email, { exact: true });
    await expect(emailText).toBeVisible();
  }
}
