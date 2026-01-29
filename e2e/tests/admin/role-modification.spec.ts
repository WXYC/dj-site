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
      // Use existing seeded user who is already an organization member
      // test_dj1 is a DJ-level user seeded in the database (test_dj2 might not be visible in roster)
      const username = TEST_USERS.dj1.username;

      // Ensure the user row is visible (in case of scrolling issues)
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

      // Verify checkbox is now checked
      const { md } = rosterPage.getRoleCheckboxes(username);
      await expect(md).toBeChecked({ timeout: 10000 });
    });

    test.afterEach(async ({ page }) => {
      // Reset test_dj1 back to DJ role if it was promoted
      const username = TEST_USERS.dj1.username;
      const { md, sm } = rosterPage.getRoleCheckboxes(username);

      // If MD is checked but SM is not, demote to DJ
      if (await md.isChecked() && !(await sm.isChecked())) {
        rosterPage.acceptConfirmDialog();
        await rosterPage.demoteFromMusicDirector(username);
        await page.waitForTimeout(1000);
      }
    });

    test("should promote Music Director to Station Manager", async ({ page }) => {
      // Use existing seeded Music Director user
      const username = TEST_USERS.musicDirector.username;

      // Ensure the user row is visible
      const userRow = rosterPage.getUserRow(username);
      await expect(userRow).toBeVisible({ timeout: 5000 });

      // Accept confirmation dialog
      rosterPage.acceptConfirmDialog();

      // Promote to SM
      await rosterPage.promoteToStationManager(username);

      // Should show success toast
      await rosterPage.expectSuccessToast("Station Manager");

      // Verify SM checkbox is now checked
      const { sm } = rosterPage.getRoleCheckboxes(username);
      await expect(sm).toBeChecked({ timeout: 10000 });

      // Demote back to MD to reset state
      rosterPage.acceptConfirmDialog();
      await rosterPage.demoteFromStationManager(username);
      await page.waitForTimeout(1000);
    });

  });

  test.describe("Demotion", () => {
    test("should demote Station Manager to Music Director", async ({ page }) => {
      // Use existing seeded demotable SM user
      const username = TEST_USERS.demotableSm.username;

      // Ensure the user row is visible
      const userRow = rosterPage.getUserRow(username);
      await expect(userRow).toBeVisible({ timeout: 5000 });

      // Accept confirmation dialog
      rosterPage.acceptConfirmDialog();

      // Demote from SM (uncheck SM checkbox)
      await rosterPage.demoteFromStationManager(username);

      // Should show success toast
      await rosterPage.expectSuccessToast("Music Director");

      // Verify SM checkbox is now unchecked
      const { sm, md } = rosterPage.getRoleCheckboxes(username);
      await expect(sm).not.toBeChecked({ timeout: 10000 });
      await expect(md).toBeChecked({ timeout: 10000 });

      // Promote back to SM to reset state
      rosterPage.acceptConfirmDialog();
      await rosterPage.promoteToStationManager(username);
      await page.waitForTimeout(1000);
    });

    test("should demote Music Director to DJ", async ({ page }) => {
      // Use test_dj1 user that was promoted to MD in a previous test
      // First promote test_dj1 to MD, then demote back to DJ
      const username = TEST_USERS.dj1.username;

      // Ensure the user row is visible
      const userRow = rosterPage.getUserRow(username);
      await expect(userRow).toBeVisible({ timeout: 5000 });

      // First, ensure the user is MD (promote if needed)
      const { md } = rosterPage.getRoleCheckboxes(username);
      if (!(await md.isChecked())) {
        rosterPage.acceptConfirmDialog();
        await rosterPage.promoteToMusicDirector(username);
        await page.waitForTimeout(1500);
        // Dismiss any toasts from the promotion step
        await page.keyboard.press("Escape");
        await page.waitForTimeout(500);
      }

      // Accept confirmation dialog for demotion
      rosterPage.acceptConfirmDialog();

      // Demote from MD (uncheck MD checkbox)
      await rosterPage.demoteFromMusicDirector(username);

      // Should show success toast - use specific text to avoid matching user name
      await rosterPage.expectSuccessToast("role updated to DJ");

      // Verify MD checkbox is now unchecked
      const checkboxes = rosterPage.getRoleCheckboxes(username);
      await expect(checkboxes.md).not.toBeChecked({ timeout: 10000 });
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
  // Run this test serially to avoid conflicts with parallel tests
  test.describe.configure({ mode: 'serial' });

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

    // Use existing seeded user who is already an organization member
    const username = TEST_USERS.dj1.username;

    // Verify user row exists and checkbox is visible
    await rosterPage.expectUserInRoster(username);
    const { md } = rosterPage.getRoleCheckboxes(username);
    await expect(md).toBeVisible({ timeout: 5000 });

    // First ensure the user is a DJ (not MD) - demote if needed
    if (await md.isChecked()) {
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

    // Verify MD checkbox is still checked after refresh
    const updatedCheckboxes = rosterPage.getRoleCheckboxes(username);
    await expect(updatedCheckboxes.md).toBeChecked({ timeout: 10000 });

    // Clean up: demote back to DJ
    rosterPage.acceptConfirmDialog();
    await rosterPage.demoteFromMusicDirector(username);
    await page.waitForTimeout(1000);
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
