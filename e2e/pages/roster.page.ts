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

  // Role select in new account form
  readonly newAccountRoleSelect: Locator;

  // Table elements
  readonly rosterTable: Locator;
  readonly tableRows: Locator;

  // Loading/error states
  readonly loadingSpinner: Locator;
  readonly errorMessage: Locator;

  // Toast notifications
  readonly successToast: Locator;
  readonly errorToast: Locator;

  // Edit modal
  readonly editModal: Locator;
  readonly editModalClose: Locator;

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

    // Role select in new account form — MUI Joy Select renders a button[role="combobox"]
    this.newAccountRoleSelect = this.newAccountRow.locator('[role="combobox"]').first();

    // Table — scoped to the roster form to avoid matching tables on other pages
    this.rosterTable = page.locator("form table");
    this.tableRows = page.locator("form tbody tr");

    // States
    this.loadingSpinner = page.locator('[role="progressbar"], .MuiCircularProgress-root');
    this.errorMessage = page.locator('text=Something has gone wrong');

    // Toasts
    this.successToast = page.locator('[data-sonner-toast][data-type="success"]');
    this.errorToast = page.locator('[data-sonner-toast][data-type="error"]');

    // Edit modal — MUI Joy ModalDialog
    this.editModal = page.locator('[role="dialog"]');
    this.editModalClose = this.editModal.locator('.MuiModalClose-root');
  }

  async goto(): Promise<void> {
    await this.page.goto("/dashboard/admin/roster");
    await this.page.waitForLoadState("domcontentloaded");
    await this.page.waitForURL("**/dashboard/admin/roster**", { timeout: 10000 });
  }

  async waitForTableLoaded(): Promise<void> {
    await this.page.waitForURL("**/dashboard/admin/roster**", { timeout: 10000 });
    await this.loadingSpinner.waitFor({ state: "hidden", timeout: 10000 }).catch(() => {});
    await this.rosterTable.waitFor({ state: "visible", timeout: 10000 });
  }

  /**
   * Wait for the roster data to settle after a mutation (create, delete, role change, email change).
   * Combines a short delay for the server round-trip with a table re-render check.
   */
  async waitForDataRefresh(): Promise<void> {
    await this.page.waitForTimeout(1000);
    await this.waitForTableLoaded();
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

    // Set role via select dropdown
    if (data.role) {
      const roleLabel =
        data.role === "stationManager" ? "Station Manager"
        : data.role === "musicDirector" ? "Music Director"
        : "DJ";
      await this.newAccountRoleSelect.click();
      await this.page.getByRole("option", { name: roleLabel }).click();
    }
    // DJ role is default, no selection needed if not specified
  }

  async submitNewAccount(): Promise<void> {
    await this.saveButton.waitFor({ state: "visible", timeout: 5000 });
    await expect(this.saveButton).toBeEnabled({ timeout: 5000 });
    await this.saveButton.click();
    await Promise.race([
      this.saveButton.waitFor({ state: "hidden", timeout: 10000 }),
      this.errorToast.waitFor({ state: "visible", timeout: 10000 }),
      this.successToast.waitFor({ state: "visible", timeout: 10000 }),
    ]).catch(() => {});
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

  // ---------------------------------------------------------------------------
  // Edit modal helpers
  // ---------------------------------------------------------------------------

  /**
   * Get the settings button for a user row (opens the edit modal).
   */
  getEditButton(username: string): Locator {
    const row = this.getUserRow(username);
    return row.locator("td").last().locator("button");
  }

  /**
   * Open the edit modal for a user.
   */
  async openEditModal(username: string): Promise<void> {
    const editBtn = this.getEditButton(username);
    await editBtn.waitFor({ state: "visible", timeout: 5000 });
    await editBtn.click();
    await this.editModal.waitFor({ state: "visible", timeout: 5000 });
  }

  /**
   * Close the edit modal.
   */
  async closeEditModal(): Promise<void> {
    // Press Escape to close the modal — more reliable than clicking the close
    // button, which can be intercepted by MUI overlay elements
    await this.page.keyboard.press("Escape");
    await this.editModal.waitFor({ state: "hidden", timeout: 5000 });
  }

  // ---------------------------------------------------------------------------
  // Role management (via edit modal)
  // ---------------------------------------------------------------------------

  /**
   * Get the role select dropdown inside the edit modal.
   */
  getModalRoleSelect(): Locator {
    return this.editModal.locator('[role="combobox"]').first();
  }

  /**
   * Get the role select dropdown for a user row (display-only chip).
   * For backward compatibility with assertion methods.
   */
  getRoleSelect(username: string): Locator {
    return this.getModalRoleSelect();
  }

  /**
   * Set a user's role via the edit modal.
   * @param username - The username of the user
   * @param roleLabel - Display label: "Member", "DJ", "Music Director", or "Station Manager"
   */
  async setUserRole(username: string, roleLabel: string): Promise<void> {
    await this.openEditModal(username);
    const select = this.getModalRoleSelect();
    await select.waitFor({ state: "visible", timeout: 5000 });
    await select.click();
    await this.page.getByRole("option", { name: roleLabel }).click();
    await this.page.waitForTimeout(1000);
    await this.closeEditModal();
  }

  /** Wrapper for backward compatibility */
  async promoteToStationManager(username: string): Promise<void> {
    await this.setUserRole(username, "Station Manager");
  }

  /** Wrapper for backward compatibility */
  async promoteToMusicDirector(username: string): Promise<void> {
    await this.setUserRole(username, "Music Director");
  }

  /** Wrapper for backward compatibility */
  async demoteFromStationManager(username: string): Promise<void> {
    await this.setUserRole(username, "Music Director");
  }

  /** Wrapper for backward compatibility */
  async demoteFromMusicDirector(username: string): Promise<void> {
    await this.setUserRole(username, "DJ");
  }

  // ---------------------------------------------------------------------------
  // Action buttons (inside edit modal)
  // ---------------------------------------------------------------------------

  /**
   * Get action buttons inside the edit modal.
   */
  getModalActionButtons(): { resetPassword: Locator; delete: Locator } {
    return {
      resetPassword: this.editModal.locator('button:has-text("Reset Password")'),
      delete: this.editModal.locator('button:has-text("Delete Account")'),
    };
  }

  /**
   * Get action buttons for a user row — opens the modal first.
   * @deprecated Use openEditModal() + getModalActionButtons() directly.
   */
  getActionButtons(username: string): { resetPassword: Locator; delete: Locator } {
    return this.getModalActionButtons();
  }

  async deleteUser(username: string): Promise<void> {
    await this.openEditModal(username);
    const { delete: deleteBtn } = this.getModalActionButtons();
    await deleteBtn.waitFor({ state: "visible", timeout: 5000 });
    await deleteBtn.click();
  }

  async resetUserPassword(username: string): Promise<void> {
    await this.openEditModal(username);
    const { resetPassword } = this.getModalActionButtons();
    await resetPassword.waitFor({ state: "visible", timeout: 5000 });
    await this.page.waitForTimeout(300);
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
      const specificToast = this.page.locator(`[data-sonner-toast][data-type="success"]:has-text("${message}")`);
      await expect(specificToast).toBeVisible({ timeout: 10000 });
    } else {
      // Use .first() to avoid strict mode violations when multiple success toasts are visible
      await expect(this.successToast.first()).toBeVisible({ timeout: 10000 });
    }
  }

  async expectErrorToast(message?: string): Promise<void> {
    if (message) {
      const specificToast = this.page.locator(`[data-sonner-toast][data-type="error"]:has-text("${message}")`);
      await expect(specificToast).toBeVisible({ timeout: 10000 });
    } else {
      await expect(this.errorToast.first()).toBeVisible({ timeout: 10000 });
    }
  }

  /**
   * Assert the role select dropdown is disabled for a user (via edit modal)
   */
  async expectRoleSelectDisabled(username: string): Promise<void> {
    await this.openEditModal(username);
    const select = this.getModalRoleSelect();
    await expect(select).toBeDisabled();
    await this.closeEditModal();
  }

  /**
   * Assert the role shows a specific label for a user (via the chip in the table row)
   */
  async expectUserRole(username: string, roleLabel: string): Promise<void> {
    const row = this.getUserRow(username);
    // The role is displayed as a Chip in the first cell
    const roleChip = row.locator("td").first().locator(".MuiChip-root").first();
    await expect(roleChip).toContainText(roleLabel, { timeout: 10000 });
  }

  async expectDeleteButtonDisabled(username: string): Promise<void> {
    await this.openEditModal(username);
    const { delete: deleteBtn } = this.getModalActionButtons();
    await expect(deleteBtn).toBeDisabled();
    await this.closeEditModal();
  }

  async expectResetPasswordButtonDisabled(username: string): Promise<void> {
    await this.openEditModal(username);
    const { resetPassword } = this.getModalActionButtons();
    await expect(resetPassword).toBeDisabled();
    await this.closeEditModal();
  }

  async getUserCount(): Promise<number> {
    await this.waitForTableLoaded();
    // Subtract 1 for the "Add" row at the bottom
    const count = await this.tableRows.count();
    return Math.max(0, count - 1);
  }

  // ---------------------------------------------------------------------------
  // Email editing (via edit modal)
  // ---------------------------------------------------------------------------

  /**
   * Get the email edit button for a user row.
   * With the modal refactor, email editing is inside the modal.
   * This opens the modal and returns the email input.
   */
  getEmailEditButton(username: string): Locator {
    // The "edit" button is now the settings button on the row
    return this.getEditButton(username);
  }

  /**
   * Get the email input field inside the edit modal
   */
  getModalEmailInput(): Locator {
    return this.editModal.locator('input[type="email"]');
  }

  /**
   * Get the email input field when editing (alias for modal version)
   */
  getEmailInput(username: string): Locator {
    return this.getModalEmailInput();
  }

  /**
   * Get the save button for email changes in the modal
   */
  getEmailConfirmButton(username: string): Locator {
    return this.editModal.locator('button:has-text("Save")');
  }

  /**
   * Start editing a user's email by opening the modal
   */
  async startEditEmail(username: string): Promise<void> {
    await this.openEditModal(username);
    await this.getModalEmailInput().waitFor({ state: "visible", timeout: 5000 });
  }

  /**
   * Update a user's email (full flow inside modal)
   */
  async updateUserEmail(username: string, newEmail: string): Promise<void> {
    await this.startEditEmail(username);
    const emailInput = this.getModalEmailInput();
    await emailInput.clear();
    await emailInput.fill(newEmail);
  }

  /**
   * Confirm the email change (click Save in the modal)
   */
  async confirmEmailChange(username: string): Promise<void> {
    const saveButton = this.getEmailConfirmButton(username);
    await saveButton.click();
  }

  /**
   * Cancel the email change (close the modal without saving)
   */
  async cancelEmailChange(username: string): Promise<void> {
    await this.closeEditModal();
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
   * Get the current email displayed for a user from the table row
   */
  async getUserEmail(username: string): Promise<string> {
    const row = this.getUserRow(username);
    const emailCell = row.locator("td").nth(4);
    return ((await emailCell.textContent()) || "").trim();
  }

  /**
   * Expect user to have specific email
   */
  async expectUserEmail(username: string, email: string): Promise<void> {
    const userEmail = await this.getUserEmail(username);
    expect(userEmail).toBe(email);
  }
}
