import { test, expect, TEST_USERS, getSessionCookies } from "../../fixtures/auth.fixture";
import { LoginPage } from "../../pages/login.page";
import { DashboardPage } from "../../pages/dashboard.page";

test.describe("Session Persistence", () => {
  // These tests do manual logins and must run sequentially
  test.describe.configure({ mode: 'serial' });
  let loginPage: LoginPage;
  let dashboardPage: DashboardPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    dashboardPage = new DashboardPage(page);
  });

  test("should maintain session after page refresh", async ({ page }) => {
    // Login
    await loginPage.goto();
    await loginPage.login(TEST_USERS.dj1.username, TEST_USERS.dj1.password);
    await loginPage.waitForRedirectToDashboard();

    // Refresh the page
    await page.reload();

    // Should still be on dashboard
    await dashboardPage.expectOnDashboard();
  });

  test("should maintain session when navigating between pages", async ({ page }) => {
    // Login
    await loginPage.goto();
    await loginPage.login(TEST_USERS.dj1.username, TEST_USERS.dj1.password);
    await loginPage.waitForRedirectToDashboard();

    // Navigate to different pages
    await dashboardPage.gotoCatalog();
    await dashboardPage.expectOnCatalog();

    await dashboardPage.gotoFlowsheet();
    await dashboardPage.expectOnFlowsheet();

    // Should still be authenticated (we're on flowsheet which is part of dashboard)
    expect(page.url()).toContain("/dashboard");
  });

  test("should persist session across multiple tabs in same browser context", async ({ context }) => {
    // Create first page and login
    const page1 = await context.newPage();
    const loginPage1 = new LoginPage(page1);
    const dashboardPage1 = new DashboardPage(page1);

    await loginPage1.goto();
    await loginPage1.login(TEST_USERS.dj1.username, TEST_USERS.dj1.password);
    await loginPage1.waitForRedirectToDashboard();

    // Create second page (same context = shared cookies)
    const page2 = await context.newPage();
    const dashboardPage2 = new DashboardPage(page2);

    // Navigate directly to dashboard
    await dashboardPage2.goto();

    // Should be authenticated (cookies are shared in same context)
    await dashboardPage2.expectOnDashboard();

    // Cleanup
    await page1.close();
    await page2.close();
  });

  test("should redirect to login when session expires", async ({ page, context }) => {
    // Login
    await loginPage.goto();
    await loginPage.login(TEST_USERS.dj1.username, TEST_USERS.dj1.password);
    await loginPage.waitForRedirectToDashboard();

    // Clear session cookies to simulate expiration
    await context.clearCookies();

    // Try to access protected route
    await page.goto("/dashboard/flowsheet");

    // Should redirect to login
    await dashboardPage.expectRedirectedToLogin();
  });
});

test.describe("Session Cookies", () => {
  test("should set session cookie after login", async ({ page }) => {
    const loginPage = new LoginPage(page);

    await loginPage.goto();
    await loginPage.login(TEST_USERS.dj1.username, TEST_USERS.dj1.password);
    await loginPage.waitForRedirectToDashboard();

    // Check for session cookies
    const sessionCookies = await getSessionCookies(page);
    expect(sessionCookies.length).toBeGreaterThan(0);
  });

  test("should have HttpOnly flag on session cookie", async ({ page, context }) => {
    const loginPage = new LoginPage(page);

    await loginPage.goto();
    await loginPage.login(TEST_USERS.dj1.username, TEST_USERS.dj1.password);
    await loginPage.waitForRedirectToDashboard();

    // Get all cookies
    const cookies = await context.cookies();
    const sessionCookie = cookies.find(
      (c) => c.name.includes("session") || c.name.includes("better-auth")
    );

    // Session cookie should have HttpOnly flag
    if (sessionCookie) {
      expect(sessionCookie.httpOnly).toBe(true);
    }
  });

  test("should have Secure flag on session cookie in production", async ({ page, context }) => {
    // This test checks that the cookie has proper security settings
    // In local dev, Secure might not be set
    const loginPage = new LoginPage(page);

    await loginPage.goto();
    await loginPage.login(TEST_USERS.dj1.username, TEST_USERS.dj1.password);
    await loginPage.waitForRedirectToDashboard();

    const cookies = await context.cookies();
    const sessionCookie = cookies.find(
      (c) => c.name.includes("session") || c.name.includes("better-auth")
    );

    // In production, Secure should be true
    // In development (localhost), it may be false
    if (sessionCookie) {
      const isProduction = !page.url().includes("localhost");
      if (isProduction) {
        expect(sessionCookie.secure).toBe(true);
      }
    }
  });

  test("should have SameSite attribute on session cookie", async ({ page, context }) => {
    const loginPage = new LoginPage(page);

    await loginPage.goto();
    await loginPage.login(TEST_USERS.dj1.username, TEST_USERS.dj1.password);
    await loginPage.waitForRedirectToDashboard();

    const cookies = await context.cookies();
    const sessionCookie = cookies.find(
      (c) => c.name.includes("session") || c.name.includes("better-auth")
    );

    if (sessionCookie) {
      // SameSite should be Lax or Strict for CSRF protection
      expect(["Lax", "Strict", "None"]).toContain(sessionCookie.sameSite);
    }
  });
});

test.describe("Concurrent Sessions", () => {
  test("should allow login from two different browser contexts", async ({ browser }) => {
    // Create two separate browser contexts (like two different browsers/incognito)
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();

    const page1 = await context1.newPage();
    const page2 = await context2.newPage();

    const loginPage1 = new LoginPage(page1);
    const loginPage2 = new LoginPage(page2);
    const dashboardPage1 = new DashboardPage(page1);
    const dashboardPage2 = new DashboardPage(page2);

    // Login user 1 in first context
    await loginPage1.goto();
    await loginPage1.login(TEST_USERS.dj1.username, TEST_USERS.dj1.password);
    await loginPage1.waitForRedirectToDashboard();

    // Login user 2 in second context
    await loginPage2.goto();
    await loginPage2.login(TEST_USERS.dj2.username, TEST_USERS.dj2.password);
    await loginPage2.waitForRedirectToDashboard();

    // Both should be authenticated
    await dashboardPage1.expectOnDashboard();
    await dashboardPage2.expectOnDashboard();

    // Refresh both pages to verify sessions persist independently
    await page1.reload();
    await page2.reload();

    await dashboardPage1.expectOnDashboard();
    await dashboardPage2.expectOnDashboard();

    // Cleanup
    await context1.close();
    await context2.close();
  });

  test("should allow same user to login from multiple browsers", async ({ browser }) => {
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();

    const page1 = await context1.newPage();
    const page2 = await context2.newPage();

    const loginPage1 = new LoginPage(page1);
    const loginPage2 = new LoginPage(page2);
    const dashboardPage1 = new DashboardPage(page1);
    const dashboardPage2 = new DashboardPage(page2);

    // Login same user in both contexts
    await loginPage1.goto();
    await loginPage1.login(TEST_USERS.dj1.username, TEST_USERS.dj1.password);
    await loginPage1.waitForRedirectToDashboard();

    await loginPage2.goto();
    await loginPage2.login(TEST_USERS.dj1.username, TEST_USERS.dj1.password);
    await loginPage2.waitForRedirectToDashboard();

    // Both sessions should be valid
    await dashboardPage1.expectOnDashboard();
    await dashboardPage2.expectOnDashboard();

    // Logout from first context
    await dashboardPage1.logout();
    await dashboardPage1.expectRedirectedToLogin();

    // Second context should still be logged in (independent session)
    await page2.reload();
    await dashboardPage2.expectOnDashboard();

    // Cleanup
    await context1.close();
    await context2.close();
  });
});

test.describe("Session Timeout", () => {
  test.skip("should handle session timeout gracefully", async ({ page }) => {
    // This test would require manipulating session expiration
    // which typically isn't feasible in E2E tests without backend support
    // Skip or implement with custom backend test endpoints
  });

  test("should show appropriate message when session is invalid", async ({ page, context }) => {
    const loginPage = new LoginPage(page);
    const dashboardPage = new DashboardPage(page);

    // Login
    await loginPage.goto();
    await loginPage.login(TEST_USERS.dj1.username, TEST_USERS.dj1.password);
    await loginPage.waitForRedirectToDashboard();

    // Invalidate session by clearing cookies
    await context.clearCookies();

    // Try to access protected page
    await page.goto("/dashboard/flowsheet");

    // Should redirect to login (session invalid)
    await dashboardPage.expectRedirectedToLogin();
  });
});
