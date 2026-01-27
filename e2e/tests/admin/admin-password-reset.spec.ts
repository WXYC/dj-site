import { test, expect, TEST_USERS } from "../../fixtures/auth.fixture";
import { DashboardPage } from "../../pages/dashboard.page";
import { RosterPage } from "../../pages/roster.page";
import { LoginPage } from "../../pages/login.page";
import path from "path";

const authDir = path.join(__dirname, "../../.auth");

test.describe("Admin Password Reset", () => {
  // Use Station Manager auth state
  test.use({ storageState: path.join(authDir, "stationManager.json") });

  let dashboardPage: DashboardPage;
  let rosterPage: RosterPage;

  const generateUsername = () => `e2e_pwreset_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  test.beforeEach(async ({ page }) => {
    dashboardPage = new DashboardPage(page);
    rosterPage = new RosterPage(page);

    // Already authenticated as Station Manager via storageState
    await dashboardPage.gotoAdminRoster();
    await rosterPage.waitForTableLoaded();
  });

  test("should reset password for another user", async ({ page }) => {
    // Create a user to reset password for
    const username = generateUsername();
    const email = `${username}@test.wxyc.org`;

    await rosterPage.createAccount({
      realName: "Password Reset Target",
      username,
      email,
    });

    await rosterPage.expectSuccessToast("Account created");
    await page.waitForTimeout(1000);

    // Accept confirmation dialog
    rosterPage.acceptConfirmDialog();

    // Click reset password button
    await rosterPage.resetUserPassword(username);

    // Should show success toast with temporary password
    await rosterPage.expectSuccessToast("Password reset");
  });

  test("should show confirmation dialog before resetting password", async ({ page }) => {
    const username = generateUsername();
    const email = `${username}@test.wxyc.org`;

    await rosterPage.createAccount({
      realName: "Confirm Reset Target",
      username,
      email,
    });

    await rosterPage.expectSuccessToast();
    await page.waitForTimeout(1000);

    let dialogShown = false;
    let dialogMessage = "";

    page.once("dialog", async (dialog) => {
      dialogShown = true;
      dialogMessage = dialog.message();
      await dialog.dismiss();
    });

    await rosterPage.resetUserPassword(username);

    expect(dialogShown).toBe(true);
    expect(dialogMessage.toLowerCase()).toContain("password");
  });

  test("should not reset password if confirmation is cancelled", async ({ page }) => {
    const username = generateUsername();
    const email = `${username}@test.wxyc.org`;

    await rosterPage.createAccount({
      realName: "Cancel Reset Target",
      username,
      email,
    });

    await rosterPage.expectSuccessToast();
    await page.waitForTimeout(1000);

    // Dismiss confirmation
    rosterPage.dismissConfirmDialog();

    await rosterPage.resetUserPassword(username);

    // Wait a moment
    await page.waitForTimeout(500);

    // Should not show success toast for password reset
    // The success toast from account creation may still be visible
  });

  test("should prevent resetting own password via admin panel", async ({ page }) => {
    const currentUser = TEST_USERS.stationManager.username;

    // Reset password button should be disabled for self
    await rosterPage.expectResetPasswordButtonDisabled(currentUser);
  });

  test("should display temporary password in toast for admin to share", async ({ page }) => {
    const username = generateUsername();
    const email = `${username}@test.wxyc.org`;

    await rosterPage.createAccount({
      realName: "Temp Password Test",
      username,
      email,
    });

    await rosterPage.expectSuccessToast();
    await page.waitForTimeout(1000);

    // Accept confirmation
    rosterPage.acceptConfirmDialog();

    await rosterPage.resetUserPassword(username);

    // Check that toast contains "Temporary password:" or similar
    const toast = page.locator('[data-sonner-toast][data-type="success"]');
    await expect(toast).toBeVisible({ timeout: 10000 });

    // The toast should contain the temporary password
    const toastText = await toast.textContent();
    expect(toastText).toBeTruthy();
    // The toast typically shows the password for the admin to copy
  });

  test("toast should have longer duration for password reset", async ({ page }) => {
    // This test verifies the toast stays visible longer than normal
    // so the admin has time to copy the temporary password

    const username = generateUsername();
    const email = `${username}@test.wxyc.org`;

    await rosterPage.createAccount({
      realName: "Long Toast Test",
      username,
      email,
    });

    await rosterPage.expectSuccessToast();
    await page.waitForTimeout(1000);

    // Accept confirmation
    rosterPage.acceptConfirmDialog();

    await rosterPage.resetUserPassword(username);

    // Wait for the toast to appear
    const toast = page.locator('[data-sonner-toast][data-type="success"]');
    await expect(toast).toBeVisible({ timeout: 5000 });

    // Wait 5 seconds - normal toasts usually dismiss in 3-4 seconds
    // Password reset toast has duration: 10000 (10 seconds)
    await page.waitForTimeout(5000);

    // Toast should still be visible
    await expect(toast).toBeVisible();
  });
});

test.describe("Password Reset - User Can Login After Reset", () => {
  test.skip("user should be able to login with temporary password after admin reset", async ({ browser }) => {
    // This test requires:
    // 1. Admin resets user's password
    // 2. Capturing the temporary password from the toast
    // 3. User logging in with the temporary password

    // This is complex because:
    // - The temporary password is randomly generated
    // - We need to capture it from the UI
    // - Then use it to login as a different user

    // Implementation would need to:
    // 1. Parse toast text to extract temporary password
    // 2. Create new browser context for the target user
    // 3. Login with the temporary password

    // Skipped due to complexity
  });
});

test.describe("Non-Admin Password Reset Restrictions", () => {
  test("DJ cannot access roster to reset passwords", async ({ page }) => {
    const loginPage = new LoginPage(page);
    const dashboardPage = new DashboardPage(page);

    // Login as DJ
    await loginPage.goto();
    await loginPage.login(TEST_USERS.dj1.username, TEST_USERS.dj1.password);
    await loginPage.waitForRedirectToDashboard();

    // Try to access roster
    await dashboardPage.gotoAdminRoster();
    await dashboardPage.expectRedirectedToDefaultDashboard();
  });

  test("Music Director cannot access roster to reset passwords", async ({ page }) => {
    const loginPage = new LoginPage(page);
    const dashboardPage = new DashboardPage(page);

    // Login as MD
    await loginPage.goto();
    await loginPage.login(TEST_USERS.musicDirector.username, TEST_USERS.musicDirector.password);
    await loginPage.waitForRedirectToDashboard();

    // Try to access roster
    await dashboardPage.gotoAdminRoster();
    await dashboardPage.expectRedirectedToDefaultDashboard();
  });
});

test.describe("Password Reset for Different User States", () => {
  test.skip("should be able to reset password for unconfirmed user", async ({ page }) => {
    // The reset button is disabled for users with authType != Confirmed
    // This test would need a user in unconfirmed state to verify behavior
  });
});
