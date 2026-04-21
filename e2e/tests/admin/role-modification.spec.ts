import { test, expect, TEST_USERS } from "../../fixtures/auth.fixture";
import { DashboardPage } from "../../pages/dashboard.page";
import { RosterPage } from "../../pages/roster.page";
import { LoginPage } from "../../pages/login.page";
import path from "path";

const authDir = path.join(__dirname, "../../.auth");

test.describe("Admin Role Modification", () => {
  // Use Station Manager auth state
  test.use({ storageState: path.join(authDir, "stationManager.json") });

  let dashboardPage: DashboardPage;
  let rosterPage: RosterPage;

  const generateUsername = () => `e2e_role_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  test.beforeEach(async ({ page }) => {
    dashboardPage = new DashboardPage(page);
    rosterPage = new RosterPage(page);

    // Already authenticated as Station Manager via storageState
    await dashboardPage.gotoAdminRoster();
    await rosterPage.waitForTableLoaded();
  });

  test.describe("Promotion", () => {
    test("should promote DJ to Music Director", async ({ page }) => {
      const username = TEST_USERS.dj1.username;

      const userRow = rosterPage.getUserRow(username);
      await expect(userRow).toBeVisible({ timeout: 5000 });

      // Accept confirmation dialog before clicking
      rosterPage.acceptConfirmDialog();

      // Promote to MD
      await rosterPage.promoteToMusicDirector(username);

      // Should show success toast
      await rosterPage.expectSuccessToast("Music Director");

      // Wait for data refetch
      await page.waitForTimeout(1500);

      // Verify role select now shows Music Director
      await rosterPage.expectUserRole(username, "Music Director");
    });

    test.afterEach(async ({ page }) => {
      // Reset test_dj1 back to DJ role if it was promoted
      const username = TEST_USERS.dj1.username;
      const select = rosterPage.getRoleSelect(username);
      const currentText = await select.textContent();

      if (currentText?.includes("Music Director")) {
        rosterPage.acceptConfirmDialog();
        await rosterPage.demoteFromMusicDirector(username);
        await page.waitForTimeout(1000);
      }
    });

    test("should promote Music Director to Station Manager", async ({ page }) => {
      const username = TEST_USERS.musicDirector.username;

      const userRow = rosterPage.getUserRow(username);
      await expect(userRow).toBeVisible({ timeout: 5000 });

      // Accept confirmation dialog
      rosterPage.acceptConfirmDialog();

      // Promote to SM
      await rosterPage.promoteToStationManager(username);

      // Should show success toast
      await rosterPage.expectSuccessToast("Station Manager");

      // Verify role select now shows Station Manager
      await rosterPage.expectUserRole(username, "Station Manager");

      // Demote back to MD to reset state
      rosterPage.acceptConfirmDialog();
      await rosterPage.demoteFromStationManager(username);
      await page.waitForTimeout(1000);
    });

  });

  test.describe("Demotion", () => {
    test("should demote Station Manager to Music Director", async ({ page }) => {
      const username = TEST_USERS.demotableSm.username;

      const userRow = rosterPage.getUserRow(username);
      await expect(userRow).toBeVisible({ timeout: 5000 });

      // Accept confirmation dialog
      rosterPage.acceptConfirmDialog();

      // Demote from SM to MD
      await rosterPage.demoteFromStationManager(username);

      // Should show success toast
      await rosterPage.expectSuccessToast("Music Director");

      // Verify role select now shows Music Director
      await rosterPage.expectUserRole(username, "Music Director");

      // Promote back to SM to reset state
      rosterPage.acceptConfirmDialog();
      await rosterPage.promoteToStationManager(username);
      await page.waitForTimeout(1000);
    });

    test("should demote Music Director to DJ", async ({ page }) => {
      const username = TEST_USERS.dj1.username;

      const userRow = rosterPage.getUserRow(username);
      await expect(userRow).toBeVisible({ timeout: 5000 });

      // First, ensure the user is MD (promote if needed)
      const select = rosterPage.getRoleSelect(username);
      const currentText = await select.textContent();
      if (!currentText?.includes("Music Director")) {
        rosterPage.acceptConfirmDialog();
        await rosterPage.promoteToMusicDirector(username);
        await page.waitForTimeout(1500);
        // Dismiss any toasts from the promotion step
        await page.keyboard.press("Escape");
        await page.waitForTimeout(500);
      }

      // Accept confirmation dialog for demotion
      rosterPage.acceptConfirmDialog();

      // Demote from MD to DJ
      await rosterPage.demoteFromMusicDirector(username);

      // Should show success toast
      await rosterPage.expectSuccessToast("role updated to DJ");

      // Verify role select now shows DJ
      await rosterPage.expectUserRole(username, "DJ");
    });
  });

  test.describe("Self-Modification Prevention", () => {
    test("should disable role select for own account", async () => {
      const currentUser = TEST_USERS.stationManager.username;

      // Role select should be disabled for self
      await rosterPage.expectRoleSelectDisabled(currentUser);
    });

    test("should show Station Manager as own role", async () => {
      const currentUser = TEST_USERS.stationManager.username;

      // Verify the select shows Station Manager but is disabled
      await rosterPage.expectUserRole(currentUser, "Station Manager");
      await rosterPage.expectRoleSelectDisabled(currentUser);
    });
  });

  test.describe("Confirmation Dialogs", () => {
    test("should show confirmation before changing role to Station Manager", async ({ page }) => {
      const username = generateUsername();
      const email = `${username}@test.wxyc.org`;

      await rosterPage.createAccount({
        realName: "Confirm Promote Test",
        username,
        email,
        role: "dj",
      });

      await rosterPage.expectSuccessToast();
      await page.waitForTimeout(1000);

      let dialogMessage = "";
      page.once("dialog", async (dialog) => {
        dialogMessage = dialog.message();
        await dialog.dismiss();
      });

      await rosterPage.setUserRole(username, "Station Manager");

      // Verify dialog was shown with role change message
      expect(dialogMessage).toContain("Station Manager");
    });

    test("should show confirmation before changing role to Music Director", async ({ page }) => {
      const username = generateUsername();
      const email = `${username}@test.wxyc.org`;

      await rosterPage.createAccount({
        realName: "Confirm Demote Test",
        username,
        email,
        role: "stationManager",
      });

      await rosterPage.expectSuccessToast();
      await page.waitForTimeout(1000);

      let dialogMessage = "";
      page.once("dialog", async (dialog) => {
        dialogMessage = dialog.message();
        await dialog.dismiss();
      });

      await rosterPage.setUserRole(username, "Music Director");

      // Verify dialog was shown
      expect(dialogMessage).toContain("Music Director");
    });

    test("should not change role if confirmation is cancelled", async ({ page }) => {
      const username = generateUsername();
      const email = `${username}@test.wxyc.org`;

      await rosterPage.createAccount({
        realName: "Cancel Test",
        username,
        email,
        role: "dj",
      });

      await rosterPage.expectSuccessToast();
      await page.waitForTimeout(1000);

      // Dismiss confirmation
      rosterPage.dismissConfirmDialog();

      // Try to change role
      await rosterPage.setUserRole(username, "Music Director");

      // Wait a moment
      await page.waitForTimeout(500);

      // Role should still show DJ
      await rosterPage.expectUserRole(username, "DJ");
    });
  });

  test.describe("Role Select Display", () => {
    test("should show Station Manager for SM users", async ({ page }) => {
      const username = generateUsername();
      const email = `${username}@test.wxyc.org`;

      await rosterPage.createAccount({
        realName: "SM Display Test",
        username,
        email,
        role: "stationManager",
      });

      await rosterPage.expectSuccessToast();
      await page.waitForTimeout(1000);

      await rosterPage.expectUserRole(username, "Station Manager");
    });

    test("should show DJ for DJ users", async ({ page }) => {
      const username = generateUsername();
      const email = `${username}@test.wxyc.org`;

      await rosterPage.createAccount({
        realName: "DJ Display Test",
        username,
        email,
        role: "dj",
      });

      await rosterPage.expectSuccessToast();
      await page.waitForTimeout(1000);

      await rosterPage.expectUserRole(username, "DJ");
    });
  });
});

test.describe("Role Change Persistence", () => {
  // Run this test serially to avoid conflicts with parallel tests
  test.describe.configure({ mode: 'serial' });

  test("role change should persist after page refresh", async ({ page }) => {
    // This test does a full login flow + multiple role changes + page reload,
    // so it needs more time than the default 15s timeout.
    test.setTimeout(30000);
    const loginPage = new LoginPage(page);
    const dashboardPage = new DashboardPage(page);
    const rosterPage = new RosterPage(page);

    // Login as SM
    await loginPage.goto();
    await loginPage.login(TEST_USERS.stationManager.username, TEST_USERS.stationManager.password);
    await loginPage.waitForRedirectToDashboard();
    await dashboardPage.gotoAdminRoster();
    await rosterPage.waitForTableLoaded();

    // Use existing seeded user who is already an organization member
    const username = TEST_USERS.dj1.username;

    // Verify user row exists and role select is visible
    await rosterPage.expectUserInRoster(username);
    const select = rosterPage.getRoleSelect(username);
    await expect(select).toBeVisible({ timeout: 5000 });

    // First ensure the user is a DJ (not MD) - demote if needed
    const currentText = await select.textContent();
    if (currentText?.includes("Music Director")) {
      rosterPage.acceptConfirmDialog();
      await rosterPage.demoteFromMusicDirector(username);
      await page.waitForTimeout(1500);
      // Dismiss any toasts
      await page.keyboard.press("Escape");
      await page.waitForTimeout(500);
    }

    // Promote to MD
    rosterPage.acceptConfirmDialog();
    await rosterPage.promoteToMusicDirector(username);

    // Wait for success toast
    await rosterPage.expectSuccessToast("Music Director");
    await page.waitForTimeout(1500);

    // Refresh the page
    await page.reload();
    await rosterPage.waitForTableLoaded();

    // Verify role select still shows Music Director after refresh
    await rosterPage.expectUserRole(username, "Music Director");

    // Clean up: demote back to DJ
    rosterPage.acceptConfirmDialog();
    await rosterPage.demoteFromMusicDirector(username);
    await page.waitForTimeout(1000);
  });

});

test.describe("Non-Admin Role Modification Restrictions", () => {
  test("Music Director cannot access roster page", async ({ page }) => {
    const loginPage = new LoginPage(page);
    const dashboardPage = new DashboardPage(page);

    // Login as MD
    await loginPage.goto();
    await loginPage.login(TEST_USERS.musicDirector.username, TEST_USERS.musicDirector.password);
    await loginPage.waitForRedirectToDashboard();

    // MD cannot access roster page
    await dashboardPage.gotoAdminRoster();
    await dashboardPage.expectRedirectedToDefaultDashboard();
  });
});
