import { test, expect, TEST_USERS } from "../../fixtures/auth.fixture";
import { SettingsPage } from "../../pages/settings.page";
import { DashboardPage } from "../../pages/dashboard.page";
import { LoginPage } from "../../pages/login.page";

test.describe("Self-Service Email Change", () => {
  let settingsPage: SettingsPage;
  let dashboardPage: DashboardPage;
  let loginPage: LoginPage;

  test.beforeEach(async ({ page, loginAs }) => {
    settingsPage = new SettingsPage(page);
    dashboardPage = new DashboardPage(page);
    loginPage = new LoginPage(page);

    // Login as a regular DJ user
    await loginAs("dj1");
    await dashboardPage.waitForPageLoad();
  });

  test("should open settings page and display email change button", async ({ page }) => {
    await settingsPage.goto();

    // Settings modal should be visible
    await expect(settingsPage.settingsModal).toBeVisible();

    // Email field should be visible
    const emailLabel = page.getByText("Email");
    await expect(emailLabel).toBeVisible();
  });

  test("should open email change modal when clicking edit button", async ({ page }) => {
    await settingsPage.goto();
    await settingsPage.openEmailChangeModal();

    await settingsPage.expectEmailChangeModalVisible();
    await expect(page.getByText("Change Email Address")).toBeVisible();
  });

  test("should display current email in the modal", async () => {
    await settingsPage.goto();
    await settingsPage.openEmailChangeModal();

    // Current email should be displayed
    await settingsPage.expectCurrentEmail(TEST_USERS.dj1.email);
  });

  test("should close modal when clicking Cancel", async () => {
    await settingsPage.goto();
    await settingsPage.openEmailChangeModal();

    await settingsPage.cancelEmailChange();

    await settingsPage.expectEmailChangeModalHidden();
  });

  test("should show validation error for empty fields", async ({ page }) => {
    await settingsPage.goto();
    await settingsPage.openEmailChangeModal();

    // Try to submit without filling fields
    await settingsPage.submitEmailChange();

    await settingsPage.expectErrorMessage("Please fill in all fields");
  });

  test("should show validation error for same email", async ({ page }) => {
    await settingsPage.goto();
    await settingsPage.openEmailChangeModal();

    // Fill in the same email
    await settingsPage.fillEmailChangeForm(
      TEST_USERS.dj1.email,
      TEST_USERS.dj1.password
    );
    await settingsPage.submitEmailChange();

    await settingsPage.expectErrorMessage(
      "New email must be different from your current email"
    );
  });

  test("should show validation error for invalid email format", async () => {
    await settingsPage.goto();
    await settingsPage.openEmailChangeModal();

    await settingsPage.fillEmailChangeForm("invalid-email", TEST_USERS.dj1.password);
    await settingsPage.submitEmailChange();

    await settingsPage.expectErrorMessage("Please enter a valid email address");
  });

  test("should show error for incorrect password", async () => {
    await settingsPage.goto();
    await settingsPage.openEmailChangeModal();

    await settingsPage.fillEmailChangeForm("new@example.com", "wrongpassword");
    await settingsPage.submitEmailChange();

    // Should show error toast or error message
    await settingsPage.expectErrorToast();
  });

  test("should show success state after valid submission", async () => {
    await settingsPage.goto();
    await settingsPage.openEmailChangeModal();

    // Use a new email that doesn't exist
    const newEmail = `test_email_change_${Date.now()}@wxyc.org`;
    await settingsPage.fillEmailChangeForm(newEmail, TEST_USERS.dj1.password);
    await settingsPage.submitEmailChange();

    // Should show success state
    await settingsPage.expectSuccessState();
    await settingsPage.expectNewEmailDisplayed(newEmail);
  });

  test("should close modal when clicking Done in success state", async () => {
    await settingsPage.goto();
    await settingsPage.openEmailChangeModal();

    const newEmail = `test_email_change_${Date.now()}@wxyc.org`;
    await settingsPage.fillEmailChangeForm(newEmail, TEST_USERS.dj1.password);
    await settingsPage.submitEmailChange();

    await settingsPage.expectSuccessState();
    await settingsPage.closeSuccessModal();

    await settingsPage.expectEmailChangeModalHidden();
  });

  test("should show success toast after successful submission", async () => {
    await settingsPage.goto();
    await settingsPage.openEmailChangeModal();

    const newEmail = `test_email_change_${Date.now()}@wxyc.org`;
    await settingsPage.fillEmailChangeForm(newEmail, TEST_USERS.dj1.password);
    await settingsPage.submitEmailChange();

    await settingsPage.expectSuccessToast("Verification email sent");
  });
});

test.describe("Email Change - Navigation", () => {
  let settingsPage: SettingsPage;

  test.beforeEach(async ({ page, loginAs }) => {
    settingsPage = new SettingsPage(page);
    await loginAs("dj1");
  });

  test("should preserve form state when switching between fields", async ({ page }) => {
    await settingsPage.goto();
    await settingsPage.openEmailChangeModal();

    // Fill in form
    await settingsPage.newEmailInput.fill("test@example.com");
    await settingsPage.passwordInput.fill("somepassword");

    // Click on another field and back
    await settingsPage.newEmailInput.click();

    // Values should still be there
    await expect(settingsPage.newEmailInput).toHaveValue("test@example.com");
    await expect(settingsPage.passwordInput).toHaveValue("somepassword");
  });

  test("should reset form when modal is closed and reopened", async () => {
    await settingsPage.goto();
    await settingsPage.openEmailChangeModal();

    // Fill in form
    await settingsPage.newEmailInput.fill("test@example.com");
    await settingsPage.passwordInput.fill("somepassword");

    // Close modal
    await settingsPage.cancelEmailChange();
    await settingsPage.expectEmailChangeModalHidden();

    // Reopen modal
    await settingsPage.openEmailChangeModal();

    // Form should be reset
    await expect(settingsPage.newEmailInput).toHaveValue("");
    await expect(settingsPage.passwordInput).toHaveValue("");
  });
});
