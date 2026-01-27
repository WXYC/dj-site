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
      // Create a DJ user to promote
      const username = generateUsername();
      const email = `${username}@test.wxyc.org`;

      await rosterPage.createAccount({
        realName: "Promotable DJ",
        username,
        email,
        role: "dj",
      });

      await rosterPage.expectSuccessToast("Account created");
      await page.waitForTimeout(1000);

      // Accept confirmation dialog
      rosterPage.acceptConfirmDialog();

      // Promote to MD
      await rosterPage.promoteToMusicDirector(username);

      // Should show success toast
      await rosterPage.expectSuccessToast("Music Director");
    });

    test("should promote Music Director to Station Manager", async ({ page }) => {
      // Create an MD user to promote
      const username = generateUsername();
      const email = `${username}@test.wxyc.org`;

      await rosterPage.createAccount({
        realName: "Promotable MD",
        username,
        email,
        role: "musicDirector",
      });

      await rosterPage.expectSuccessToast("Account created");
      await page.waitForTimeout(1000);

      // Accept confirmation dialog
      rosterPage.acceptConfirmDialog();

      // Promote to SM
      await rosterPage.promoteToStationManager(username);

      // Should show success toast
      await rosterPage.expectSuccessToast("Station Manager");
    });

    test("should promote DJ directly to Station Manager", async ({ page }) => {
      // Create a DJ user
      const username = generateUsername();
      const email = `${username}@test.wxyc.org`;

      await rosterPage.createAccount({
        realName: "Direct Promotable DJ",
        username,
        email,
        role: "dj",
      });

      await rosterPage.expectSuccessToast("Account created");
      await page.waitForTimeout(1000);

      // Accept confirmation dialog
      rosterPage.acceptConfirmDialog();

      // Promote directly to SM
      await rosterPage.promoteToStationManager(username);

      // Should show success toast
      await rosterPage.expectSuccessToast("Station Manager");
    });
  });

  test.describe("Demotion", () => {
    test("should demote Station Manager to Music Director", async ({ page }) => {
      // Create an SM user to demote
      const username = generateUsername();
      const email = `${username}@test.wxyc.org`;

      await rosterPage.createAccount({
        realName: "Demotable SM",
        username,
        email,
        role: "stationManager",
      });

      await rosterPage.expectSuccessToast("Account created");
      await page.waitForTimeout(1000);

      // Accept confirmation dialog
      rosterPage.acceptConfirmDialog();

      // Demote from SM (uncheck SM checkbox)
      await rosterPage.demoteFromStationManager(username);

      // Should show success toast
      await rosterPage.expectSuccessToast("Music Director");
    });

    test("should demote Music Director to DJ", async ({ page }) => {
      // Create an MD user to demote
      const username = generateUsername();
      const email = `${username}@test.wxyc.org`;

      await rosterPage.createAccount({
        realName: "Demotable MD",
        username,
        email,
        role: "musicDirector",
      });

      await rosterPage.expectSuccessToast("Account created");
      await page.waitForTimeout(1000);

      // Accept confirmation dialog
      rosterPage.acceptConfirmDialog();

      // Demote from MD (uncheck MD checkbox)
      await rosterPage.demoteFromMusicDirector(username);

      // Should show success toast
      await rosterPage.expectSuccessToast("DJ");
    });
  });

  test.describe("Self-Modification Prevention", () => {
    test("should disable role checkboxes for own account", async ({ page }) => {
      const currentUser = TEST_USERS.stationManager.username;

      // Both checkboxes should be disabled for self
      await rosterPage.expectRoleCheckboxDisabled(currentUser, "sm");
      await rosterPage.expectRoleCheckboxDisabled(currentUser, "md");
    });

    test("should not allow admin to demote themselves", async ({ page }) => {
      const currentUser = TEST_USERS.stationManager.username;

      // Verify the SM checkbox is checked but disabled
      const { sm } = rosterPage.getRoleCheckboxes(currentUser);
      await expect(sm).toBeChecked();
      await expect(sm).toBeDisabled();
    });
  });

  test.describe("Confirmation Dialogs", () => {
    test("should show confirmation before promoting to Station Manager", async ({ page }) => {
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

      await rosterPage.promoteToStationManager(username);

      // Verify dialog was shown with promotion message
      expect(dialogMessage).toContain("Station Manager");
    });

    test("should show confirmation before demoting from Station Manager", async ({ page }) => {
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

      await rosterPage.demoteFromStationManager(username);

      // Verify dialog was shown
      expect(dialogMessage).toContain("Station Manager");
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

      // Try to promote
      await rosterPage.promoteToMusicDirector(username);

      // Wait a moment
      await page.waitForTimeout(500);

      // MD checkbox should still be unchecked
      const { md } = rosterPage.getRoleCheckboxes(username);
      await expect(md).not.toBeChecked();
    });
  });

  test.describe("MD Checkbox Behavior", () => {
    test("MD checkbox should be disabled when SM is checked", async ({ page }) => {
      const username = generateUsername();
      const email = `${username}@test.wxyc.org`;

      await rosterPage.createAccount({
        realName: "MD Disable Test",
        username,
        email,
        role: "stationManager",
      });

      await rosterPage.expectSuccessToast();
      await page.waitForTimeout(1000);

      // For SM users, MD checkbox should be checked but disabled
      const { md, sm } = rosterPage.getRoleCheckboxes(username);
      await expect(sm).toBeChecked();
      await expect(md).toBeChecked(); // MD is implicitly included in SM
      await expect(md).toBeDisabled(); // Can't uncheck MD while SM is checked
    });

    test("MD checkbox should be enabled for non-SM users", async ({ page }) => {
      const username = generateUsername();
      const email = `${username}@test.wxyc.org`;

      await rosterPage.createAccount({
        realName: "MD Enable Test",
        username,
        email,
        role: "dj",
      });

      await rosterPage.expectSuccessToast();
      await page.waitForTimeout(1000);

      // For DJ users, MD checkbox should be enabled
      const { md } = rosterPage.getRoleCheckboxes(username);
      await expect(md).toBeEnabled();
    });
  });
});

test.describe("Role Change Persistence", () => {
  test("role change should persist after page refresh", async ({ page }) => {
    const loginPage = new LoginPage(page);
    const dashboardPage = new DashboardPage(page);
    const rosterPage = new RosterPage(page);

    // Login as SM
    await loginPage.goto();
    await loginPage.login(TEST_USERS.stationManager.username, TEST_USERS.stationManager.password);
    await loginPage.waitForRedirectToDashboard();
    await dashboardPage.gotoAdminRoster();
    await rosterPage.waitForTableLoaded();

    // Create a DJ user
    const username = `persist_${Date.now()}`;
    const email = `${username}@test.wxyc.org`;

    await rosterPage.createAccount({
      realName: "Persist Test",
      username,
      email,
      role: "dj",
    });

    await rosterPage.expectSuccessToast();
    await page.waitForTimeout(1000);

    // Promote to MD
    rosterPage.acceptConfirmDialog();
    await rosterPage.promoteToMusicDirector(username);
    await rosterPage.expectSuccessToast("Music Director");

    // Refresh the page
    await page.reload();
    await rosterPage.waitForTableLoaded();

    // Verify MD checkbox is still checked
    const { md } = rosterPage.getRoleCheckboxes(username);
    await expect(md).toBeChecked();
  });

  test.skip("promoted user should have new permissions after logout/login", async ({ browser }) => {
    // This test requires:
    // 1. Create user, promote them
    // 2. Have that user login and verify permissions
    // Skipped due to complexity of multi-user authentication in single test
  });
});

test.describe("Non-Admin Role Modification Restrictions", () => {
  test("Music Director cannot see role checkboxes", async ({ page }) => {
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
