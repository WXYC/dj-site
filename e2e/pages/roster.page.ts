import { Page, Locator, expect } from "@playwright/test";

/**
 * Page Object Model for the Admin Roster Page
 */
export class RosterPage {
  readonly page: Page;

  // Action buttons
  readonly addDjButton: Locator;
  readonly exportButton: Locator;

  // Search form
  readonly searchInput: Locator;

  // New account form elements
  readonly newAccountRow: Locator;
  readonly realNameInput: Locator;
  readonly usernameInput: Locator;
  readonly djNameInput: Locator;
  readonly emailInput: Locator;
  readonly saveButton: Locator;

  // Role checkboxes in new account form
  readonly newAccountSmCheckbox: Locator;
  readonly newAccountMdCheckbox: Locator;

  // Table elements
  readonly rosterTable: Locator;
  readonly tableRows: Locator;

  // Loading/error states
  readonly loadingSpinner: Locator;
  readonly errorMessage: Locator;

  // Toast notifications
  readonly successToast: Locator;
  readonly errorToast: Locator;

  constructor(page: Page) {
    this.page = page;

    // Action buttons
    this.addDjButton = page.locator('button:has-text("Add DJ")');
    this.exportButton = page.locator('button:has-text("Export")');

    // Search
    this.searchInput = page.locator('input[placeholder*="Search"], input[name="search"]');

    // New account form (appears as a table row with editable fields)
    // Use accessible names with exact match since MUI Joy inputs may not have name attributes
    this.newAccountRow = page.locator('tr:has(button:has-text("Save"))');
    this.realNameInput = page.getByRole('textbox', { name: 'Name', exact: true });
    this.usernameInput = page.getByRole('textbox', { name: 'Username', exact: true });
    this.djNameInput = page.getByRole('textbox', { name: 'DJ Name (Optional)', exact: true });
    this.emailInput = page.getByRole('textbox', { name: 'Email', exact: true });
    // Save button is inside the new account row
    this.saveButton = page.locator('tr:has(button:has-text("Save")) button:has-text("Save")');

    // Role checkboxes in new account form - first and second checkbox in the form row
    this.newAccountSmCheckbox = this.newAccountRow.locator('input[type="checkbox"]').first();
    this.newAccountMdCheckbox = this.newAccountRow.locator('input[type="checkbox"]').nth(1);

    // Table
    this.rosterTable = page.locator("table");
    this.tableRows = page.locator("tbody tr");

    // States
    this.loadingSpinner = page.locator('[role="progressbar"], .MuiCircularProgress-root');
    this.errorMessage = page.locator('text=Something has gone wrong');

    // Toasts
    this.successToast = page.locator('[data-sonner-toast][data-type="success"]');
    this.errorToast = page.locator('[data-sonner-toast][data-type="error"]');
  }

  async goto(): Promise<void> {
    await this.page.goto("/dashboard/admin/roster");
    await this.page.waitForLoadState("domcontentloaded");
  }

  async waitForTableLoaded(): Promise<void> {
    // Wait for loading spinner to disappear and table rows to appear
    await this.loadingSpinner.waitFor({ state: "hidden", timeout: 10000 }).catch(() => {});
    await this.rosterTable.waitFor({ state: "visible", timeout: 10000 });
  }

  async clickAddDj(): Promise<void> {
    // There are two "Add" buttons - use the main one at the top right
    const mainAddButton = this.page.locator('button:has-text("Add DJ")');
    await mainAddButton.click();
    await this.realNameInput.waitFor({ state: "visible", timeout: 5000 });
  }

  async fillNewAccountForm(data: {
    realName: string;
    username: string;
    email: string;
    djName?: string;
    role?: "dj" | "musicDirector" | "stationManager";
  }): Promise<void> {
    await this.realNameInput.fill(data.realName);
    await this.usernameInput.fill(data.username);
    await this.emailInput.fill(data.email);

    if (data.djName) {
      await this.djNameInput.fill(data.djName);
    }

    // Set role via checkboxes
    if (data.role === "stationManager") {
      await this.newAccountSmCheckbox.check();
    } else if (data.role === "musicDirector") {
      await this.newAccountMdCheckbox.check();
    }
    // DJ role is default, no checkbox needed
  }

  async submitNewAccount(): Promise<void> {
    // Wait for save button to be visible and enabled
    await this.saveButton.waitFor({ state: "visible", timeout: 5000 });
    await expect(this.saveButton).toBeEnabled({ timeout: 5000 });
    // Small delay to ensure form is ready
    await this.page.waitForTimeout(500);
    // Dispatch SubmitEvent on the form - this triggers React's onSubmit handler
    await this.saveButton.evaluate((btn) => {
      const form = btn.closest("form");
      if (form) {
        const event = new SubmitEvent("submit", {
          bubbles: true,
          cancelable: true,
          submitter: btn,
        });
        form.dispatchEvent(event);
      }
    });
    // Wait for submission result - either form closes (success) or error toast appears
    await Promise.race([
      this.saveButton.waitFor({ state: "hidden", timeout: 15000 }),
      this.errorToast.waitFor({ state: "visible", timeout: 15000 }),
      this.successToast.waitFor({ state: "visible", timeout: 15000 }),
    ]).catch(() => {
      // If none of the above happens, continue anyway
    });
    // Give the UI time to update
    await this.page.waitForTimeout(500);
  }

  async createAccount(data: {
    realName: string;
    username: string;
    email: string;
    djName?: string;
    role?: "dj" | "musicDirector" | "stationManager";
  }): Promise<void> {
    await this.clickAddDj();
    await this.fillNewAccountForm(data);
    await this.submitNewAccount();
  }

  /**
   * Get a user row by username
   */
  getUserRow(username: string): Locator {
    return this.page.locator(`tr:has-text("${username}")`);
  }

  /**
   * Get role checkboxes for a user row
   */
  getRoleCheckboxes(username: string): { sm: Locator; md: Locator } {
    const row = this.getUserRow(username);
    return {
      sm: row.locator('input[type="checkbox"]').first(),
      md: row.locator('input[type="checkbox"]').nth(1),
    };
  }

  /**
   * Get action buttons for a user row
   * The buttons are IconButtons in a Stack - reset password is first, delete is last
   */
  getActionButtons(username: string): { resetPassword: Locator; delete: Locator } {
    const row = this.getUserRow(username);
    // The buttons are in the last cell (td) of the row, in a Stack
    const actionCell = row.locator("td").last();
    const buttons = actionCell.locator("button");
    return {
      resetPassword: buttons.first(),
      delete: buttons.last(),
    };
  }

  async promoteToStationManager(username: string): Promise<void> {
    const { sm } = this.getRoleCheckboxes(username);
    // Wait for checkbox to be ready
    await sm.waitFor({ state: "visible", timeout: 5000 });
    // Use force click to ensure the checkbox is toggled
    await sm.click({ force: true });
    await this.page.waitForTimeout(1000);
  }

  async promoteToMusicDirector(username: string): Promise<void> {
    const { md } = this.getRoleCheckboxes(username);
    // Wait for checkbox to be ready
    await md.waitFor({ state: "visible", timeout: 5000 });
    // Use force click to ensure the checkbox is toggled
    await md.click({ force: true });
    await this.page.waitForTimeout(1000);
  }

  async demoteFromStationManager(username: string): Promise<void> {
    const { sm } = this.getRoleCheckboxes(username);
    await sm.waitFor({ state: "visible", timeout: 5000 });
    await sm.click({ force: true });
    await this.page.waitForTimeout(1000);
  }

  async demoteFromMusicDirector(username: string): Promise<void> {
    const { md } = this.getRoleCheckboxes(username);
    await md.waitFor({ state: "visible", timeout: 5000 });
    await md.click({ force: true });
    await this.page.waitForTimeout(1000);
  }

  async deleteUser(username: string): Promise<void> {
    const { delete: deleteBtn } = this.getActionButtons(username);
    // Wait for button to be visible and enabled
    await deleteBtn.waitFor({ state: "visible", timeout: 5000 });
    // Use regular click to properly trigger dialog interception
    await deleteBtn.click();
  }

  async resetUserPassword(username: string): Promise<void> {
    const { resetPassword } = this.getActionButtons(username);
    // Wait for button to be visible and enabled
    await resetPassword.waitFor({ state: "visible", timeout: 5000 });
    // Small delay to ensure button is interactive
    await this.page.waitForTimeout(300);
    // Use force click to bypass any overlays (like Tooltips)
    await resetPassword.click({ force: true });
  }

  /**
   * Set up dialog handler to accept confirm dialogs.
   * MUST be called BEFORE the action that triggers the dialog.
   */
  setupAcceptConfirmDialog(): void {
    this.page.once("dialog", async (dialog) => {
      await dialog.accept();
    });
  }

  /**
   * Alias for setupAcceptConfirmDialog for test compatibility
   */
  acceptConfirmDialog(): void {
    this.setupAcceptConfirmDialog();
  }

  /**
   * Set up dialog handler to dismiss confirm dialogs.
   * MUST be called BEFORE the action that triggers the dialog.
   */
  setupDismissConfirmDialog(): void {
    this.page.once("dialog", async (dialog) => {
      await dialog.dismiss();
    });
  }

  /**
   * Alias for setupDismissConfirmDialog for test compatibility
   */
  dismissConfirmDialog(): void {
    this.setupDismissConfirmDialog();
  }

  /**
   * Delete a user with confirmation
   */
  async deleteUserWithConfirm(username: string): Promise<void> {
    this.setupAcceptConfirmDialog();
    await this.deleteUser(username);
  }

  /**
   * Reset password with confirmation
   */
  async resetPasswordWithConfirm(username: string): Promise<void> {
    this.setupAcceptConfirmDialog();
    await this.resetUserPassword(username);
  }

  /**
   * Promote to station manager with confirmation
   */
  async promoteToSmWithConfirm(username: string): Promise<void> {
    this.setupAcceptConfirmDialog();
    await this.promoteToStationManager(username);
  }

  /**
   * Demote from station manager with confirmation
   */
  async demoteFromSmWithConfirm(username: string): Promise<void> {
    this.setupAcceptConfirmDialog();
    await this.demoteFromStationManager(username);
  }

  async expectUserInRoster(username: string): Promise<void> {
    await expect(this.getUserRow(username)).toBeVisible();
  }

  async expectUserNotInRoster(username: string): Promise<void> {
    await expect(this.getUserRow(username)).not.toBeVisible();
  }

  async expectSuccessToast(message?: string): Promise<void> {
    if (message) {
      // Wait for a toast containing the specific message
      const specificToast = this.page.locator(`[data-sonner-toast][data-type="success"]:has-text("${message}")`);
      await expect(specificToast).toBeVisible({ timeout: 10000 });
    } else {
      await expect(this.successToast).toBeVisible({ timeout: 10000 });
    }
  }

  async expectErrorToast(message?: string): Promise<void> {
    if (message) {
      // Wait for a toast containing the specific message
      const specificToast = this.page.locator(`[data-sonner-toast][data-type="error"]:has-text("${message}")`);
      await expect(specificToast).toBeVisible({ timeout: 10000 });
    } else {
      await expect(this.errorToast).toBeVisible({ timeout: 10000 });
    }
  }

  async expectRoleCheckboxDisabled(username: string, role: "sm" | "md"): Promise<void> {
    const checkboxes = this.getRoleCheckboxes(username);
    await expect(checkboxes[role]).toBeDisabled();
  }

  async expectDeleteButtonDisabled(username: string): Promise<void> {
    const { delete: deleteBtn } = this.getActionButtons(username);
    await expect(deleteBtn).toBeDisabled();
  }

  async expectResetPasswordButtonDisabled(username: string): Promise<void> {
    const { resetPassword } = this.getActionButtons(username);
    await expect(resetPassword).toBeDisabled();
  }

  async getUserCount(): Promise<number> {
    await this.waitForTableLoaded();
    // Subtract 1 for the "Add" row at the bottom
    const count = await this.tableRows.count();
    return Math.max(0, count - 1);
  }

  /**
   * Get the email edit button for a user row
   */
  getEmailEditButton(username: string): Locator {
    const row = this.getUserRow(username);
    // The email cell has a Stack with the email text and an edit button
    // Find the cell containing the email, then get the button inside it
    return row.locator("td").nth(4).locator("button");
  }

  /**
   * Get the email input field when editing
   */
  getEmailInput(username: string): Locator {
    const row = this.getUserRow(username);
    return row.locator("td").nth(4).locator("input");
  }

  /**
   * Get the confirm button when editing email
   */
  getEmailConfirmButton(username: string): Locator {
    const row = this.getUserRow(username);
    // The confirm button is the first button in the email cell (green checkmark)
    return row.locator("td").nth(4).locator("button").first();
  }

  /**
   * Get the cancel button when editing email
   */
  getEmailCancelButton(username: string): Locator {
    const row = this.getUserRow(username);
    // The cancel button is the second button in the email cell
    return row.locator("td").nth(4).locator("button").nth(1);
  }

  /**
   * Start editing a user's email
   */
  async startEditEmail(username: string): Promise<void> {
    const editButton = this.getEmailEditButton(username);
    await editButton.waitFor({ state: "visible", timeout: 5000 });
    // Use JavaScript click to bypass MUI Chips in adjacent cells that intercept pointer events
    await editButton.evaluate((el) => (el as HTMLElement).click());
    // Wait for input to appear
    await this.getEmailInput(username).waitFor({ state: "visible", timeout: 5000 });
  }

  /**
   * Update a user's email (full flow)
   */
  async updateUserEmail(username: string, newEmail: string): Promise<void> {
    await this.startEditEmail(username);
    const emailInput = this.getEmailInput(username);
    await emailInput.clear();
    await emailInput.fill(newEmail);
  }

  /**
   * Confirm the email change
   */
  async confirmEmailChange(username: string): Promise<void> {
    const confirmButton = this.getEmailConfirmButton(username);
    // Use JavaScript click to bypass MUI Chips in adjacent cells that intercept pointer events
    await confirmButton.evaluate((el) => (el as HTMLElement).click());
  }

  /**
   * Cancel the email change
   */
  async cancelEmailChange(username: string): Promise<void> {
    const cancelButton = this.getEmailCancelButton(username);
    // Use JavaScript click to bypass MUI Chips in adjacent cells that intercept pointer events
    await cancelButton.evaluate((el) => (el as HTMLElement).click());
  }

  /**
   * Update email with confirmation dialog
   */
  async updateEmailWithConfirm(username: string, newEmail: string): Promise<void> {
    this.setupAcceptConfirmDialog();
    await this.updateUserEmail(username, newEmail);
    await this.confirmEmailChange(username);
  }

  /**
   * Get the current email displayed for a user
   */
  async getUserEmail(username: string): Promise<string> {
    const row = this.getUserRow(username);
    const emailCell = row.locator("td").nth(4);
    // Get the text content, filtering out any button text
    const emailSpan = emailCell.locator("span").first();
    return (await emailSpan.textContent()) || "";
  }

  /**
   * Expect user to have specific email
   */
  async expectUserEmail(username: string, email: string): Promise<void> {
    const userEmail = await this.getUserEmail(username);
    expect(userEmail).toBe(email);
  }
}
