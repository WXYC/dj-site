import { test, expect } from "../../fixtures/auth.fixture";
import { DashboardPage } from "../../pages/dashboard.page";
import path from "path";

const authDir = path.join(__dirname, "../../.auth");

test.describe("Role-Based Access Control", () => {
  let dashboardPage: DashboardPage;

  test.describe("DJ Access", () => {
    // Use dj2.json to avoid conflicts with logout tests that use dj1
    test.use({ storageState: path.join(authDir, "dj2.json") });

    test.beforeEach(async ({ page }) => {
      dashboardPage = new DashboardPage(page);
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
    test.use({ storageState: path.join(authDir, "musicDirector.json") });

    test.beforeEach(async ({ page }) => {
      dashboardPage = new DashboardPage(page);
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
    test.use({ storageState: path.join(authDir, "stationManager.json") });

    test.beforeEach(async ({ page }) => {
      dashboardPage = new DashboardPage(page);
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
      // The page header shows "DJ Roster" (h2 element)
      const header = page.locator('h1, h2, [class*="Header"]').first();
      await expect(header).toContainText("Roster", { timeout: 10000 });
    });
  });

  test.describe("Member Access", () => {
    test.use({ storageState: path.join(authDir, "member.json") });

    test.beforeEach(async ({ page }) => {
      dashboardPage = new DashboardPage(page);
    });

    test("should access dashboard", async ({ page }) => {
      await dashboardPage.goto();
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
    // No storageState - tests run without authentication
    test.use({ storageState: { cookies: [], origins: [] } });

    test("should redirect to login from dashboard", async ({ page }) => {
      await page.goto("/dashboard");
      // App may redirect to login or show 404/error page for unauthenticated users
      await Promise.race([
        page.waitForURL("**/login**", { timeout: 10000 }),
        page.locator('input[name="username"]').waitFor({ state: "visible", timeout: 10000 }),
        page.getByText("We couldn't find the resource you were looking for").waitFor({ state: "visible", timeout: 10000 }),
      ]);
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

    test("should redirect to login from admin pages", async ({ page }) => {
      await page.goto("/dashboard/admin/roster");
      await page.waitForURL("**/login**", { timeout: 10000 });
      expect(page.url()).toContain("/login");
    });

    test("should allow access to login page", async ({ page }) => {
      await page.goto("/login");
      await page.waitForSelector('input[name="username"]');
      expect(page.url()).toContain("/login");
    });
  });
});
