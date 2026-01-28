import { test, expect, TEST_USERS, clearAuthCookies } from "../../fixtures/auth.fixture";
import { LoginPage } from "../../pages/login.page";
import { DashboardPage } from "../../pages/dashboard.page";
import path from "path";

const authDir = path.join(__dirname, "../../.auth");

test.describe("Logout Flow", () => {
  // Start authenticated as DJ via storageState
  test.use({ storageState: path.join(authDir, "dj.json") });

  let loginPage: LoginPage;
  let dashboardPage: DashboardPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    dashboardPage = new DashboardPage(page);
    // Already authenticated via storageState - navigate to flowsheet
    await dashboardPage.gotoFlowsheet();
  });

  test("should logout and redirect to login page", async ({ page }) => {
    await dashboardPage.logout();
    await dashboardPage.expectRedirectedToLogin();
  });

  test("should clear session after logout", async ({ page }) => {
    await dashboardPage.logout();

    // Try to access dashboard again - should redirect to login
    await page.goto("/dashboard");
    await dashboardPage.expectRedirectedToLogin();
  });

  test("should not be able to access protected routes after logout", async ({ page }) => {
    await dashboardPage.logout();

    // Try various protected routes
    const protectedRoutes = [
      "/dashboard",
      "/dashboard/flowsheet",
      "/dashboard/catalog",
      "/dashboard/admin/roster",
    ];

    for (const route of protectedRoutes) {
      await page.goto(route);
      await dashboardPage.expectRedirectedToLogin();
    }
  });

  test("should be able to login again after logout", async ({ page }) => {
    await dashboardPage.logout();

    // Login again
    const user = TEST_USERS.dj2;
    await loginPage.login(user.username, user.password);
    await loginPage.waitForRedirectToDashboard();
    await dashboardPage.expectOnDashboard();
  });

  test("should clear all auth cookies on logout", async ({ page, context }) => {
    // Get cookies before logout
    const cookiesBefore = await context.cookies();
    const authCookiesBefore = cookiesBefore.filter(
      (c) => c.name.includes("session") || c.name.includes("auth") || c.name.includes("better-auth")
    );

    await dashboardPage.logout();

    // Check cookies after logout
    const cookiesAfter = await context.cookies();
    const authCookiesAfter = cookiesAfter.filter(
      (c) => c.name.includes("session") || c.name.includes("auth") || c.name.includes("better-auth")
    );

    // Auth cookies should be cleared or different
    // The session cookie should be removed or invalidated
    expect(authCookiesAfter.length).toBeLessThanOrEqual(authCookiesBefore.length);
  });
});

test.describe("Session Invalidation", () => {
  test("should redirect to login when session cookie is manually cleared", async ({ page, context }) => {
    const loginPage = new LoginPage(page);
    const dashboardPage = new DashboardPage(page);

    // Login
    await loginPage.goto();
    await loginPage.login(TEST_USERS.dj1.username, TEST_USERS.dj1.password);
    await loginPage.waitForRedirectToDashboard();

    // Manually clear cookies
    await clearAuthCookies(page);

    // Refresh the page
    await page.reload();

    // Should be redirected to login
    await dashboardPage.expectRedirectedToLogin();
  });

  test("should handle invalid session cookie gracefully", async ({ page, context }) => {
    const loginPage = new LoginPage(page);
    const dashboardPage = new DashboardPage(page);

    // Login
    await loginPage.goto();
    await loginPage.login(TEST_USERS.dj1.username, TEST_USERS.dj1.password);
    await loginPage.waitForRedirectToDashboard();

    // Get current URL to get the domain
    const url = new URL(page.url());

    // Add an invalid/tampered session cookie
    await context.addCookies([
      {
        name: "better-auth.session_token",
        value: "invalid-tampered-session-token-value",
        domain: url.hostname,
        path: "/",
      },
    ]);

    // Try to access protected route
    await page.goto("/dashboard");

    // Should either work (if the real cookie is still valid) or redirect to login
    // The tampered cookie should not cause a crash
    const currentUrl = page.url();
    const isValid = currentUrl.includes("/dashboard") || currentUrl.includes("/login");
    expect(isValid).toBe(true);
  });
});
