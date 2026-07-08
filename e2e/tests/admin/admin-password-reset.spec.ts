import { test, expect, TEST_USERS, completeOnboardingWithInviteToken, getVerificationToken } from "../../fixtures/auth.fixture";
import { DashboardPage } from "../../pages/dashboard.page";
import { RosterPage } from "../../pages/roster.page";
import { LoginPage } from "../../pages/login.page";
import { generateUsername, generateEmail } from "../../helpers/test-data";
import path from "path";

const authDir = path.join(__dirname, "../../.auth");

test.describe("Admin Password Reset", () => {
  test.use({ storageState: path.join(authDir, "stationManager.json") });

  let dashboardPage: DashboardPage;
  let rosterPage: RosterPage;

  const targetUser = TEST_USERS.adminReset1;

  test.beforeEach(async ({ page }) => {
    dashboardPage = new DashboardPage(page);
    rosterPage = new RosterPage(page);

    await dashboardPage.gotoAdminRoster();
    await rosterPage.waitForTableLoaded();
  });

  test("should send a password reset email for another user", async () => {
    await rosterPage.sendPasswordResetEmail(targetUser.username);
    await rosterPage.expectSuccessToast("Password reset email sent");
  });

  test("should prevent sending password reset for own account", async () => {
    await rosterPage.expectSendPasswordResetButtonHidden(TEST_USERS.stationManager.username);
  });

  test("should include the recipient email in the success toast", async ({ page }) => {
    await rosterPage.sendPasswordResetEmail(targetUser.username);

    const toast = page.locator('[data-sonner-toast][data-type="success"]');
    await expect(toast).toBeVisible({ timeout: 10000 });
    await expect(toast).toContainText(targetUser.email);
  });
});

test.describe("Password Reset - User Can Login After Reset", () => {
  test.use({ storageState: path.join(authDir, "stationManager.json") });

  test("opens the reset form instead of the dashboard when another account is signed in", async ({
    page,
  }) => {
    const rosterPage = new RosterPage(page);
    const targetUser = TEST_USERS.adminReset1;

    await rosterPage.sendPasswordResetEmail(targetUser.username);
    await rosterPage.expectSuccessToast("Password reset email sent");

    const tokenData = await getVerificationToken(targetUser.email);
    if (!tokenData?.token) {
      throw new Error(`No reset token found for ${targetUser.email}`);
    }

    await page.goto(`/login?token=${encodeURIComponent(tokenData.token)}`);

    await expect(page).not.toHaveURL(/\/dashboard/);
    await expect(page.locator('input[name="password"]')).toBeVisible({
      timeout: 15000,
    });
    await expect(page.locator('input[name="confirmPassword"]')).toBeVisible();
  });

  test("user should be able to set a new password from the emailed reset link", async ({
    page,
    browser,
  }) => {
    const dashboardPage = new DashboardPage(page);
    const rosterPage = new RosterPage(page);
    const targetUser = TEST_USERS.adminReset1;
    const newPassword = `NewPassword${Date.now()}`;

    await dashboardPage.gotoAdminRoster();
    await rosterPage.waitForTableLoaded();
    await rosterPage.sendPasswordResetEmail(targetUser.username);
    await rosterPage.expectSuccessToast("Password reset email sent");

    const tokenData = await getVerificationToken(targetUser.email);
    if (!tokenData?.token) {
      throw new Error(`No reset token found for ${targetUser.email}`);
    }

    const baseURL = process.env.E2E_BASE_URL || "http://localhost:3000";
    const userContext = await browser.newContext({ baseURL, storageState: undefined });
    const userPage = await userContext.newPage();
    await userContext.clearCookies();

    const userLoginPage = new LoginPage(userPage);
    const userDashboard = new DashboardPage(userPage);

    await userLoginPage.gotoWithToken(tokenData.token);
    await userLoginPage.resetPassword(newPassword, newPassword);
    await userLoginPage.expectSuccessToast();

    await userLoginPage.goto();
    await userPage.waitForLoadState("networkidle");
    await userLoginPage.switchToPasswordLogin();
    await userLoginPage.login(targetUser.username, newPassword);
    await userLoginPage.waitForRedirectToDashboard();
    await userDashboard.expectOnDashboard();

    await userContext.close();
  });
});

test.describe("Non-Admin Password Reset Restrictions", () => {
  test.describe("DJ Restrictions", () => {
    test.use({ storageState: path.join(authDir, "dj.json") });

    test("DJ cannot access roster to reset passwords", async ({ page }) => {
      const dashboardPage = new DashboardPage(page);
      await dashboardPage.gotoAdminRoster();
      await dashboardPage.expectRedirectedToDefaultDashboard();
    });
  });

  test.describe("Music Director Restrictions", () => {
    test.use({ storageState: path.join(authDir, "musicDirector.json") });

    test("Music Director cannot access roster to reset passwords", async ({ page }) => {
      const dashboardPage = new DashboardPage(page);
      await dashboardPage.gotoAdminRoster();
      await dashboardPage.expectRedirectedToDefaultDashboard();
    });
  });
});

test.describe("Password Reset for Different User States", () => {
  test.use({ storageState: path.join(authDir, "stationManager.json") });

  test("should send an invite email for a new incomplete user", async ({ page, browser }) => {
    const dashboardPage = new DashboardPage(page);
    const rosterPage = new RosterPage(page);

    const username = generateUsername("unconfirmed");
    const email = generateEmail(username);

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
    await rosterPage.waitForDataRefresh();

    await rosterPage.sendPasswordResetEmail(username);
    await rosterPage.expectSuccessToast("Password reset email sent");

    const baseURL = process.env.E2E_BASE_URL || "http://localhost:3000";
    const userContext = await browser.newContext({ baseURL, storageState: undefined });
    const userPage = await userContext.newPage();
    const userDashboard = new DashboardPage(userPage);

    await completeOnboardingWithInviteToken(userPage, email, "NewPassword1");
    await userDashboard.expectOnDashboard();

    await userContext.close();
  });
});
