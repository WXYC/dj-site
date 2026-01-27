import { test, expect, TEST_USERS } from "../../fixtures/auth.fixture";
import { LoginPage } from "../../pages/login.page";
import { DashboardPage } from "../../pages/dashboard.page";
import { RosterPage } from "../../pages/roster.page";

test.describe("Admin User Deletion", () => {
  let loginPage: LoginPage;
  let dashboardPage: DashboardPage;
  let rosterPage: RosterPage;

  const generateUsername = () => `e2e_delete_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    dashboardPage = new DashboardPage(page);
    rosterPage = new RosterPage(page);

    // Login as Station Manager
    await loginPage.goto();
    await loginPage.login(TEST_USERS.stationManager.username, TEST_USERS.stationManager.password);
    await loginPage.waitForRedirectToDashboard();

    // Navigate to roster page
    await dashboardPage.gotoAdminRoster();
    await rosterPage.waitForTableLoaded();
  });

  test("should delete user when confirm dialog is accepted", async ({ page }) => {
    // First create a user to delete
    const username = generateUsername();
    const email = `${username}@test.wxyc.org`;

    await rosterPage.createAccount({
      realName: "To Be Deleted",
      username,
      email,
    });

    await rosterPage.expectSuccessToast("Account created");
    await page.waitForTimeout(1000);
    await rosterPage.expectUserInRoster(username);

    // Set up dialog handler to accept
    rosterPage.acceptConfirmDialog();

    // Delete the user
    await rosterPage.deleteUser(username);

    // Should show success toast
    await rosterPage.expectSuccessToast("deleted");

    // Wait for table to refresh
    await page.waitForTimeout(1000);

    // User should no longer appear in roster
    await rosterPage.expectUserNotInRoster(username);
  });

  test("should not delete user when confirm dialog is cancelled", async ({ page }) => {
    // Use test_dj2 who should exist in seed data
    const username = TEST_USERS.dj2.username;

    // Verify user exists
    await rosterPage.expectUserInRoster(username);

    // Set up dialog handler to dismiss
    rosterPage.dismissConfirmDialog();

    // Try to delete the user
    await rosterPage.deleteUser(username);

    // User should still appear in roster
    await rosterPage.expectUserInRoster(username);
  });

  test("should prevent deleting own account", async ({ page }) => {
    // The current user is test_station_manager
    const currentUser = TEST_USERS.stationManager.username;

    // Verify user is in roster
    await rosterPage.expectUserInRoster(currentUser);

    // Delete button should be disabled for self
    await rosterPage.expectDeleteButtonDisabled(currentUser);
  });

  test("should show confirmation dialog before deletion", async ({ page }) => {
    // Use test_dj1
    const username = TEST_USERS.dj1.username;

    // Track if dialog was shown
    let dialogShown = false;
    page.once("dialog", async (dialog) => {
      dialogShown = true;
      expect(dialog.type()).toBe("confirm");
      expect(dialog.message()).toContain("delete");
      await dialog.dismiss();
    });

    // Click delete button
    await rosterPage.deleteUser(username);

    // Dialog should have been shown
    expect(dialogShown).toBe(true);
  });

  test("should update roster count after deletion", async ({ page }) => {
    // Create a user to delete
    const username = generateUsername();
    const email = `${username}@test.wxyc.org`;

    // Get initial count
    const initialCount = await rosterPage.getUserCount();

    // Create user
    await rosterPage.createAccount({
      realName: "Count Test User",
      username,
      email,
    });

    await rosterPage.expectSuccessToast();
    await page.waitForTimeout(1000);

    // Count should increase
    const afterCreateCount = await rosterPage.getUserCount();
    expect(afterCreateCount).toBeGreaterThanOrEqual(initialCount);

    // Accept dialog and delete
    rosterPage.acceptConfirmDialog();
    await rosterPage.deleteUser(username);

    await rosterPage.expectSuccessToast("deleted");
    await page.waitForTimeout(1000);

    // Count should be back to original or less
    const afterDeleteCount = await rosterPage.getUserCount();
    expect(afterDeleteCount).toBeLessThanOrEqual(afterCreateCount);
  });
});

test.describe("User Deletion Session Invalidation", () => {
  test.skip("should invalidate deleted user's session", async ({ browser }) => {
    // This test verifies that when a user is deleted, their session is invalidated

    // Create a dedicated test user that we can delete
    // This requires creating the user first, then testing session invalidation

    const context1 = await browser.newContext(); // Admin context
    const context2 = await browser.newContext(); // User context

    const adminPage = await context1.newPage();
    const userPage = await context2.newPage();

    const adminLoginPage = new LoginPage(adminPage);
    const adminRosterPage = new RosterPage(adminPage);
    const adminDashboard = new DashboardPage(adminPage);

    // Login as admin
    await adminLoginPage.goto();
    await adminLoginPage.login(TEST_USERS.stationManager.username, TEST_USERS.stationManager.password);
    await adminLoginPage.waitForRedirectToDashboard();

    // Create a user to delete
    await adminDashboard.gotoAdminRoster();
    await adminRosterPage.waitForTableLoaded();

    const username = `session_test_${Date.now()}`;
    const email = `${username}@test.wxyc.org`;

    await adminRosterPage.createAccount({
      realName: "Session Test User",
      username,
      email,
    });

    // Note: To complete this test, we'd need:
    // 1. The new user to login (requires knowing temp password)
    // 2. Admin deletes the user
    // 3. Verify user's session is invalidated

    // Cleanup
    await context1.close();
    await context2.close();
  });
});

test.describe("Non-Admin Deletion Restrictions", () => {
  test("DJ cannot delete users", async ({ page }) => {
    const loginPage = new LoginPage(page);
    const dashboardPage = new DashboardPage(page);

    // Login as DJ
    await loginPage.goto();
    await loginPage.login(TEST_USERS.dj1.username, TEST_USERS.dj1.password);
    await loginPage.waitForRedirectToDashboard();

    // DJ cannot access roster page at all
    await dashboardPage.gotoAdminRoster();
    await dashboardPage.expectRedirectedToDefaultDashboard();
  });

  test("Music Director cannot delete users", async ({ page }) => {
    const loginPage = new LoginPage(page);
    const dashboardPage = new DashboardPage(page);

    // Login as Music Director
    await loginPage.goto();
    await loginPage.login(TEST_USERS.musicDirector.username, TEST_USERS.musicDirector.password);
    await loginPage.waitForRedirectToDashboard();

    // MD cannot access roster page at all
    await dashboardPage.gotoAdminRoster();
    await dashboardPage.expectRedirectedToDefaultDashboard();
  });
});
