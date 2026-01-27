import { test, expect, TEST_USERS } from "../../fixtures/auth.fixture";
import { LoginPage } from "../../pages/login.page";
import { DashboardPage } from "../../pages/dashboard.page";
import { RosterPage } from "../../pages/roster.page";

test.describe("Role-Based Access Control", () => {
  let loginPage: LoginPage;
  let dashboardPage: DashboardPage;
  let rosterPage: RosterPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    dashboardPage = new DashboardPage(page);
    rosterPage = new RosterPage(page);
  });

  test.describe("DJ Access", () => {
    test.beforeEach(async ({ page }) => {
      await loginPage.goto();
      await loginPage.login(TEST_USERS.dj1.username, TEST_USERS.dj1.password);
      await loginPage.waitForRedirectToDashboard();
    });

    test("should access flowsheet page", async ({ page }) => {
      await dashboardPage.gotoFlowsheet();
      await dashboardPage.expectOnFlowsheet();
    });

    test("should access catalog page", async ({ page }) => {
      await dashboardPage.gotoCatalog();
      await dashboardPage.expectOnCatalog();
    });

    test("should be redirected from admin roster page", async ({ page }) => {
      await dashboardPage.gotoAdminRoster();
      // DJ should be redirected to default dashboard page (insufficient permissions)
      await dashboardPage.expectRedirectedToDefaultDashboard();
    });

    test("should not see admin navigation link", async ({ page }) => {
      await dashboardPage.waitForPageLoad();
      // Admin roster link should not be visible for DJ users
      await expect(dashboardPage.rosterLink).not.toBeVisible({ timeout: 5000 });
    });
  });

  test.describe("Music Director Access", () => {
    test.beforeEach(async ({ page }) => {
      await loginPage.goto();
      await loginPage.login(TEST_USERS.musicDirector.username, TEST_USERS.musicDirector.password);
      await loginPage.waitForRedirectToDashboard();
    });

    test("should access flowsheet page", async ({ page }) => {
      await dashboardPage.gotoFlowsheet();
      await dashboardPage.expectOnFlowsheet();
    });

    test("should access catalog page", async ({ page }) => {
      await dashboardPage.gotoCatalog();
      await dashboardPage.expectOnCatalog();
    });

    test("should be redirected from admin roster page", async ({ page }) => {
      await dashboardPage.gotoAdminRoster();
      // MD should also be redirected (roster requires SM)
      await dashboardPage.expectRedirectedToDefaultDashboard();
    });
  });

  test.describe("Station Manager Access", () => {
    test.beforeEach(async ({ page }) => {
      await loginPage.goto();
      await loginPage.login(TEST_USERS.stationManager.username, TEST_USERS.stationManager.password);
      await loginPage.waitForRedirectToDashboard();
    });

    test("should access flowsheet page", async ({ page }) => {
      await dashboardPage.gotoFlowsheet();
      await dashboardPage.expectOnFlowsheet();
    });

    test("should access catalog page", async ({ page }) => {
      await dashboardPage.gotoCatalog();
      await dashboardPage.expectOnCatalog();
    });

    test("should access admin roster page", async ({ page }) => {
      await dashboardPage.gotoAdminRoster();
      // SM should have full access
      await dashboardPage.expectOnAdminRoster();
    });

    test("should see DJ Roster page header", async ({ page }) => {
      await dashboardPage.gotoAdminRoster();
      await dashboardPage.waitForPageLoad();
      // The page header shows "DJ Roster"
      const header = page.locator('h1, [class*="Header"]').first();
      await expect(header).toContainText("Roster", { timeout: 10000 });
    });
  });

  test.describe("Member Access", () => {
    test.beforeEach(async ({ page }) => {
      await loginPage.goto();
      await loginPage.login(TEST_USERS.member.username, TEST_USERS.member.password);
      await loginPage.waitForRedirectToDashboard();
    });

    test("should access dashboard", async ({ page }) => {
      await dashboardPage.expectOnDashboard();
    });

    test("should be redirected from admin pages", async ({ page }) => {
      await dashboardPage.gotoAdminRoster();
      // Member should be redirected to default dashboard
      await dashboardPage.expectRedirectedToDefaultDashboard();
    });

    test("should access catalog page (read only)", async ({ page }) => {
      await dashboardPage.gotoCatalog();
      await dashboardPage.expectOnCatalog();
    });
  });

  test.describe("Unauthenticated Access", () => {
    test("should redirect to login from dashboard", async ({ page }) => {
      await page.goto("/dashboard");
      await page.waitForURL("**/login**", { timeout: 10000 });
      expect(page.url()).toContain("/login");
    });

    test("should redirect to login from flowsheet", async ({ page }) => {
      await page.goto("/dashboard/flowsheet");
      await page.waitForURL("**/login**", { timeout: 10000 });
      expect(page.url()).toContain("/login");
    });

    test("should redirect to login from catalog", async ({ page }) => {
      await page.goto("/dashboard/catalog");
      await page.waitForURL("**/login**", { timeout: 10000 });
      expect(page.url()).toContain("/login");
    });

    test("should redirect to login from admin roster", async ({ page }) => {
      await page.goto("/dashboard/admin/roster");
      await page.waitForURL("**/login**", { timeout: 10000 });
      expect(page.url()).toContain("/login");
    });

    test("should allow access to login page", async ({ page }) => {
      await page.goto("/login");
      expect(page.url()).toContain("/login");
    });
  });

  test.describe("Role Hierarchy", () => {
    test("Station Manager has all DJ permissions", async ({ page }) => {
      await loginPage.goto();
      await loginPage.login(TEST_USERS.stationManager.username, TEST_USERS.stationManager.password);
      await loginPage.waitForRedirectToDashboard();

      // SM should access all pages a DJ can
      await dashboardPage.gotoFlowsheet();
      await dashboardPage.expectOnFlowsheet();

      await dashboardPage.gotoCatalog();
      await dashboardPage.expectOnCatalog();
    });

    test("Station Manager has all Music Director permissions", async ({ page }) => {
      await loginPage.goto();
      await loginPage.login(TEST_USERS.stationManager.username, TEST_USERS.stationManager.password);
      await loginPage.waitForRedirectToDashboard();

      // SM should access all pages an MD can
      await dashboardPage.gotoCatalog();
      await dashboardPage.expectOnCatalog();
    });

    test("Music Director has all DJ permissions", async ({ page }) => {
      await loginPage.goto();
      await loginPage.login(TEST_USERS.musicDirector.username, TEST_USERS.musicDirector.password);
      await loginPage.waitForRedirectToDashboard();

      // MD should access all pages a DJ can
      await dashboardPage.gotoFlowsheet();
      await dashboardPage.expectOnFlowsheet();

      await dashboardPage.gotoCatalog();
      await dashboardPage.expectOnCatalog();
    });
  });

  test.describe("Direct URL Access Protection", () => {
    test("DJ cannot access admin routes via direct URL", async ({ page }) => {
      await loginPage.goto();
      await loginPage.login(TEST_USERS.dj1.username, TEST_USERS.dj1.password);
      await loginPage.waitForRedirectToDashboard();

      // Try to access admin routes directly
      await page.goto("/dashboard/admin/roster");
      // DJ should be redirected to default dashboard
      await dashboardPage.expectRedirectedToDefaultDashboard();
    });

    test("Logged out user cannot access any protected routes via direct URL", async ({ page }) => {
      const protectedRoutes = [
        "/dashboard",
        "/dashboard/flowsheet",
        "/dashboard/catalog",
        "/dashboard/admin/roster",
      ];

      for (const route of protectedRoutes) {
        await page.goto(route);
        await page.waitForURL("**/login**", { timeout: 10000 });
        expect(page.url()).toContain("/login");
      }
    });
  });
});
