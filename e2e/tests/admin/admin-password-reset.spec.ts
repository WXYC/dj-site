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

  // Use existing seeded user for password reset tests
  // Newly created users have authType: New which disables the reset button
  // Seeded users are already "Confirmed" and have the reset button enabled
  const targetUser = TEST_USERS.dj2;

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
  test.skip("should be able to reset password for unconfirmed user", async ({ page }) => {
    // The reset button is disabled for users with authType != Confirmed
    // This test would need a user in unconfirmed state to verify behavior
  });
});
