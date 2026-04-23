import { test, expect, TEST_USERS } from "../../fixtures/auth.fixture";
import { DashboardPage } from "../../pages/dashboard.page";
import { RosterPage } from "../../pages/roster.page";
import { LoginPage } from "../../pages/login.page";
import { generateUsername, generateEmail } from "../../helpers/test-data";
import path from "path";

const authDir = path.join(__dirname, "../../.auth");

test.describe("Admin Role Modification", () => {
  // Use Station Manager auth state
  test.use({ storageState: path.join(authDir, "stationManager.json") });

  let dashboardPage: DashboardPage;
  let rosterPage: RosterPage;

  test.beforeEach(async ({ page }) => {
    dashboardPage = new DashboardPage(page);
    rosterPage = new RosterPage(page);

    // Already authenticated as Station Manager via storageState
    await dashboardPage.gotoAdminRoster();
    await rosterPage.waitForTableLoaded();
  });

  test.describe("Promotion", () => {
    test("should promote DJ to Music Director", async () => {
      // Create a temp user at DJ role so we don't mutate shared seeded users
      const username = generateUsername("role");
      const email = generateEmail(username);
      await rosterPage.createAccount({ realName: "Promote DJ Test", username, email, role: "dj" });
      await rosterPage.expectSuccessToast();
      await rosterPage.waitForDataRefresh();

      // Accept confirmation dialog before clicking
      rosterPage.acceptConfirmDialog();

      // Promote to MD
      await rosterPage.promoteToMusicDirector(username);

      // Should show success toast
      await rosterPage.expectSuccessToast("Music Director");

      // Wait for data refetch
      await rosterPage.waitForDataRefresh();

      // Verify role select now shows Music Director
      await rosterPage.expectUserRole(username, "Music Director");
    });

    test("should promote Music Director to Station Manager", async () => {
      // Create a temp user at Music Director role
      const username = generateUsername("role");
      const email = generateEmail(username);
      await rosterPage.createAccount({ realName: "Promote MD Test", username, email, role: "musicDirector" });
      await rosterPage.expectSuccessToast();
      await rosterPage.waitForDataRefresh();

      // Accept confirmation dialog
      rosterPage.acceptConfirmDialog();

      // Promote to SM
      await rosterPage.promoteToStationManager(username);

      // Should show success toast
      await rosterPage.expectSuccessToast("Station Manager");

      // Verify role select now shows Station Manager
      await rosterPage.expectUserRole(username, "Station Manager");
    });
  });

  test.describe("Demotion", () => {
    test("should demote Station Manager to Music Director", async () => {
      // Create a temp user at Station Manager role
      const username = generateUsername("role");
      const email = generateEmail(username);
      await rosterPage.createAccount({ realName: "Demote SM Test", username, email, role: "stationManager" });
      await rosterPage.expectSuccessToast();
      await rosterPage.waitForDataRefresh();

      // Accept confirmation dialog
      rosterPage.acceptConfirmDialog();

      // Demote from SM to MD
      await rosterPage.demoteFromStationManager(username);

      // Should show success toast
      await rosterPage.expectSuccessToast("Music Director");

      // Verify role select now shows Music Director
      await rosterPage.expectUserRole(username, "Music Director");
    });

    test("should demote Music Director to DJ", async () => {
      // Create a temp user at Music Director role
      const username = generateUsername("role");
      const email = generateEmail(username);
      await rosterPage.createAccount({ realName: "Demote MD Test", username, email, role: "musicDirector" });
      await rosterPage.expectSuccessToast();
      await rosterPage.waitForDataRefresh();

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
      const username = generateUsername("role");
      const email = generateEmail(username);

      await rosterPage.createAccount({
        realName: "Confirm Promote Test",
        username,
        email,
        role: "dj",
      });

      await rosterPage.expectSuccessToast();
      await rosterPage.waitForDataRefresh();

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
      const username = generateUsername("role");
      const email = generateEmail(username);

      await rosterPage.createAccount({
        realName: "Confirm Demote Test",
        username,
        email,
        role: "stationManager",
      });

      await rosterPage.expectSuccessToast();
      await rosterPage.waitForDataRefresh();

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
      const username = generateUsername("role");
      const email = generateEmail(username);

      await rosterPage.createAccount({
        realName: "Cancel Test",
        username,
        email,
        role: "dj",
      });

      await rosterPage.expectSuccessToast();
      await rosterPage.waitForDataRefresh();

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
    test("should show Station Manager for SM users", async () => {
      const username = generateUsername("role");
      const email = generateEmail(username);

      await rosterPage.createAccount({
        realName: "SM Display Test",
        username,
        email,
        role: "stationManager",
      });

      await rosterPage.expectSuccessToast();
      await rosterPage.waitForDataRefresh();

      await rosterPage.expectUserRole(username, "Station Manager");
    });

    test("should show DJ for DJ users", async () => {
      const username = generateUsername("role");
      const email = generateEmail(username);

      await rosterPage.createAccount({
        realName: "DJ Display Test",
        username,
        email,
        role: "dj",
      });

      await rosterPage.expectSuccessToast();
      await rosterPage.waitForDataRefresh();

      await rosterPage.expectUserRole(username, "DJ");
    });
  });
});

test.describe("Role Change Persistence", () => {
  test("role change should persist after page refresh", async ({ page }) => {
    // This test does a full login flow + role change + page reload,
    // so it needs more time than the default timeout.
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

    // Create a temp user to test persistence
    const username = generateUsername("role");
    const email = generateEmail(username);
    await rosterPage.createAccount({ realName: "Persistence Test", username, email, role: "dj" });
    await rosterPage.expectSuccessToast();
    await rosterPage.waitForDataRefresh();

    // Promote to MD
    rosterPage.acceptConfirmDialog();
    await rosterPage.promoteToMusicDirector(username);

    // Wait for success toast
    await rosterPage.expectSuccessToast("Music Director");
    await rosterPage.waitForDataRefresh();

    // Refresh the page
    await page.reload();
    await rosterPage.waitForTableLoaded();

    // Verify role select still shows Music Director after refresh
    await rosterPage.expectUserRole(username, "Music Director");
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
