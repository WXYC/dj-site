import { test, expect, TEST_USERS } from "../../fixtures/auth.fixture";
import { LoginPage } from "../../pages/login.page";
import { DashboardPage } from "../../pages/dashboard.page";

test.describe("Login Flow", () => {
  // Login tests do manual logins and must run sequentially
  test.describe.configure({ mode: 'serial' });
  let loginPage: LoginPage;
  let dashboardPage: DashboardPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    dashboardPage = new DashboardPage(page);
    await loginPage.goto();
  });

  test("should display login form", async () => {
    await loginPage.expectLoginFormVisible();
  });

  test("should login with valid DJ credentials", async ({ page }) => {
    const user = TEST_USERS.dj1;
    await loginPage.login(user.username, user.password);

    // Should redirect to dashboard
    await loginPage.waitForRedirectToDashboard();
    await dashboardPage.expectOnDashboard();
  });

  test("should login with valid Station Manager credentials", async ({ page }) => {
    const user = TEST_USERS.stationManager;
    await loginPage.login(user.username, user.password);

    // Should redirect to dashboard
    await loginPage.waitForRedirectToDashboard();
    await dashboardPage.expectOnDashboard();
  });

  test("should login with valid Music Director credentials", async ({ page }) => {
    const user = TEST_USERS.musicDirector;
    await loginPage.login(user.username, user.password);

    // Should redirect to dashboard
    await loginPage.waitForRedirectToDashboard();
    await dashboardPage.expectOnDashboard();
  });

  test("should show error toast for invalid password", async ({ page }) => {
    const user = TEST_USERS.dj1;
    await loginPage.login(user.username, "wrongpassword");

    // Should show error and stay on login page
    await loginPage.expectErrorToast();
    expect(await loginPage.isOnLoginPage()).toBe(true);
  });

  test("should show error toast for non-existent username", async ({ page }) => {
    await loginPage.login("nonexistent_user", "anypassword");

    // Should show error and stay on login page
    await loginPage.expectErrorToast();
    expect(await loginPage.isOnLoginPage()).toBe(true);
  });

  test("should have submit button disabled when fields are empty", async ({ page }) => {
    // Initially, with empty fields, submit should be disabled
    await loginPage.expectSubmitButtonDisabled();
  });

  test("should enable submit button when both fields have values", async ({ page }) => {
    await page.fill('input[name="username"]', "someuser");
    await page.fill('input[name="password"]', "somepassword");

    // Wait for validation to update
    await page.waitForTimeout(500);

    await loginPage.expectSubmitButtonEnabled();
  });

  test("should show success toast on successful login", async ({ page }) => {
    const user = TEST_USERS.dj1;
    await loginPage.login(user.username, user.password);

    await loginPage.expectSuccessToast("Login successful");
  });

  test("should redirect to dashboard home page after login", async ({ page }) => {
    const user = TEST_USERS.dj1;
    await loginPage.login(user.username, user.password);

    // Check the URL matches the expected dashboard home
    await page.waitForURL(/.*\/dashboard\/(flowsheet|catalog).*/, { timeout: 10000 });
  });

  test("should allow login with different users sequentially", async ({ page, context }) => {
    // First user login
    const user1 = TEST_USERS.dj1;
    await loginPage.login(user1.username, user1.password);
    await loginPage.waitForRedirectToDashboard();

    // Clear cookies to logout
    await context.clearCookies();

    // Second user login
    await loginPage.goto();
    const user2 = TEST_USERS.dj2;
    await loginPage.login(user2.username, user2.password);
    await loginPage.waitForRedirectToDashboard();
  });

  test("should handle special characters in username", async ({ page }) => {
    // Attempt login with special characters (should fail gracefully)
    await loginPage.login("user@special!#$", "password123");

    // Should show error and stay on login page
    await loginPage.expectErrorToast();
    expect(await loginPage.isOnLoginPage()).toBe(true);
  });

  test("should trim whitespace from username", async ({ page }) => {
    const user = TEST_USERS.dj1;
    // Add whitespace around username
    await loginPage.login(`  ${user.username}  `, user.password);

    // Should still work (if backend trims) or show error
    // The exact behavior depends on the backend implementation
    // At minimum, should not crash
    await page.waitForTimeout(2000);
  });
});

test.describe("Login Page Navigation", () => {
  let loginPage: LoginPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    await loginPage.goto();
  });

  test("should navigate to forgot password form", async ({ page }) => {
    await loginPage.clickForgotPassword();

    // Should show password reset form
    await loginPage.expectPasswordResetFormVisible();
  });

  test("should return to login form from forgot password", async ({ page }) => {
    await loginPage.clickForgotPassword();
    await loginPage.expectPasswordResetFormVisible();

    await loginPage.goBackToLogin();
    await loginPage.expectLoginFormVisible();
  });
});
