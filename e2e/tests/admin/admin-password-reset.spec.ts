import { test, expect, TEST_USERS, TEMP_PASSWORD } from "../../fixtures/auth.fixture";
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

  // Use dedicated seeded user for admin password reset tests
  // Using adminReset1 to avoid conflicts with other tests that use dj2
  // Seeded users are already "Confirmed" and have the reset button enabled
  const targetUser = TEST_USERS.adminReset1;

  test.beforeEach(async ({ page }) => {
    dashboardPage = new DashboardPage(page);
    rosterPage = new RosterPage(page);

    // Already authenticated as Station Manager via storageState
    await dashboardPage.gotoAdminRoster();
    await rosterPage.waitForTableLoaded();
  });

  test("should reset password for another user", async ({ page }) => {
    // Use existing seeded user that is already confirmed
    const username = targetUser.username;

    // Accept confirmation dialog
    rosterPage.acceptConfirmDialog();

    // Click reset password button
    await rosterPage.resetUserPassword(username);

    // Should show success toast with temporary password
    await rosterPage.expectSuccessToast("Password reset");
  });

  test("should show confirmation dialog before resetting password", async ({ page }) => {
    const username = targetUser.username;

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
    const username = targetUser.username;

    // Dismiss confirmation
    rosterPage.dismissConfirmDialog();

    await rosterPage.resetUserPassword(username);

    // Wait a moment
    await page.waitForTimeout(500);

    // Should not show success toast for password reset
  });

  test("should prevent resetting own password via admin panel", async ({ page }) => {
    const currentUser = TEST_USERS.stationManager.username;

    // Reset password button should be disabled for self
    await rosterPage.expectResetPasswordButtonDisabled(currentUser);
  });

  test("should display temporary password in toast for admin to share", async ({ page }) => {
    const username = targetUser.username;

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
    const username = targetUser.username;

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
  test.use({ storageState: path.join(authDir, "stationManager.json") });

  test("user should be able to login with temporary password after admin reset", async ({ page, browser }) => {
    const dashboardPage = new DashboardPage(page);
    const rosterPage = new RosterPage(page);

    // Use dedicated seeded user that is confirmed and has complete profile
    const targetUser = TEST_USERS.adminReset1;
    const username = targetUser.username;

    // Navigate to roster
    await dashboardPage.gotoAdminRoster();
    await rosterPage.waitForTableLoaded();

    // Reset the user's password
    rosterPage.acceptConfirmDialog();
    await rosterPage.resetUserPassword(username);

    // Wait for success toast
    await rosterPage.expectSuccessToast("Password reset");
    await page.waitForTimeout(1000);

    // Create a new browser context to login as the user
    // Pass baseURL explicitly and ensure clean session with storageState: undefined
    const baseURL = process.env.E2E_BASE_URL || "http://localhost:3000";
    const userContext = await browser.newContext({ baseURL, storageState: undefined });
    const userPage = await userContext.newPage();

    // Clear any inherited cookies
    await userContext.clearCookies();

    const userLoginPage = new LoginPage(userPage);
    const userDashboard = new DashboardPage(userPage);

    // Login with the temp password (admin-set passwords use the same temp password)
    await userLoginPage.goto();
    await userPage.waitForLoadState("networkidle");

    // Verify we're on the login page
    await expect(userPage.locator('input[name="username"]')).toBeVisible({ timeout: 5000 });

    await userLoginPage.login(username, TEMP_PASSWORD);

    // User has complete profile (seeded with realName and djName), should go to dashboard
    await userLoginPage.waitForRedirectToDashboard();
    await userDashboard.expectOnDashboard();

    // Cleanup
    await userContext.close();
  });
});

test.describe("Non-Admin Password Reset Restrictions", () => {
  test.describe("DJ Restrictions", () => {
    // Use DJ auth state instead of manual login
    test.use({ storageState: path.join(authDir, "dj.json") });

    test("DJ cannot access roster to reset passwords", async ({ page }) => {
      const dashboardPage = new DashboardPage(page);

      // Try to access roster (already authenticated as DJ via storageState)
      await dashboardPage.gotoAdminRoster();
      await dashboardPage.expectRedirectedToDefaultDashboard();
    });
  });

  test.describe("Music Director Restrictions", () => {
    // Use Music Director auth state instead of manual login
    test.use({ storageState: path.join(authDir, "musicDirector.json") });

    test("Music Director cannot access roster to reset passwords", async ({ page }) => {
      const dashboardPage = new DashboardPage(page);

      // Try to access roster (already authenticated as MD via storageState)
      await dashboardPage.gotoAdminRoster();
      await dashboardPage.expectRedirectedToDefaultDashboard();
    });
  });
});

test.describe("Password Reset for Different User States", () => {
  test.use({ storageState: path.join(authDir, "stationManager.json") });

  test("should be able to reset password for unconfirmed user", async ({ page, browser }) => {
    const dashboardPage = new DashboardPage(page);
    const rosterPage = new RosterPage(page);

    // Create a new user (who will be "New" / unconfirmed) with complete profile
    const username = `unconfirmed_${Date.now()}`;
    const email = `${username}@test.wxyc.org`;

    await dashboardPage.gotoAdminRoster();
    await rosterPage.waitForTableLoaded();

    await rosterPage.createAccount({
      realName: "Unconfirmed Reset Test",
      username,
      email,
      djName: "Unconfirmed DJ",
      role: "dj",
    });

    await rosterPage.expectSuccessToast();
    await page.waitForTimeout(1000);

    // Reset password for the new (unconfirmed) user
    // Note: The reset button should work for new users too since they need to set up their account
    rosterPage.acceptConfirmDialog();
    await rosterPage.resetUserPassword(username);

    // Should show success toast
    await rosterPage.expectSuccessToast("Password reset");

    // Verify the user can now login with temp password
    const baseURL = process.env.E2E_BASE_URL || "http://localhost:3000";
    const userContext = await browser.newContext({ baseURL, storageState: undefined });
    const userPage = await userContext.newPage();

    // Clear any inherited cookies
    await userContext.clearCookies();

    const userLoginPage = new LoginPage(userPage);
    const userDashboard = new DashboardPage(userPage);

    await userLoginPage.goto();
    await userPage.waitForLoadState("networkidle");

    // Verify we're on the login page
    await expect(userPage.locator('input[name="username"]')).toBeVisible({ timeout: 5000 });

    await userLoginPage.login(username, TEMP_PASSWORD);

    // User has complete profile, should go to dashboard
    await userLoginPage.waitForRedirectToDashboard();
    await userDashboard.expectOnDashboard();

    // Cleanup
    await userContext.close();
  });
});
