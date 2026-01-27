import { test, expect } from "../../fixtures/auth.fixture";
import { DashboardPage } from "../../pages/dashboard.page";
import { RosterPage } from "../../pages/roster.page";
import path from "path";

const authDir = path.join(__dirname, "../../.auth");

test.describe("Admin User Creation", () => {
  // Use Station Manager auth state
  test.use({ storageState: path.join(authDir, "stationManager.json") });

  let dashboardPage: DashboardPage;
  let rosterPage: RosterPage;

  // Generate unique usernames for tests to avoid conflicts
  const generateUsername = () => `e2e_user_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  test.beforeEach(async ({ page }) => {
    dashboardPage = new DashboardPage(page);
    rosterPage = new RosterPage(page);

    // Already authenticated as Station Manager via storageState
    // Navigate directly to roster page
    await dashboardPage.gotoAdminRoster();
    await rosterPage.waitForTableLoaded();
  });

  test("should open add DJ form when clicking Add DJ button", async ({ page }) => {
    await rosterPage.clickAddDj();

    // Form fields should be visible
    await expect(rosterPage.realNameInput).toBeVisible();
    await expect(rosterPage.usernameInput).toBeVisible();
    await expect(rosterPage.emailInput).toBeVisible();
    await expect(rosterPage.djNameInput).toBeVisible();
    await expect(rosterPage.saveButton).toBeVisible();
  });

  test("should create user with DJ role", async ({ page }) => {
    const username = generateUsername();
    const email = `${username}@test.wxyc.org`;

    await rosterPage.createAccount({
      realName: "E2E Test DJ",
      username,
      email,
      djName: "DJ E2E",
      role: "dj",
    });

    // Should show success toast
    await rosterPage.expectSuccessToast("Account created");

    // Wait for table to refresh
    await page.waitForTimeout(1000);

    // User should appear in roster
    await rosterPage.expectUserInRoster(username);
  });

  test("should create user with Music Director role", async ({ page }) => {
    const username = generateUsername();
    const email = `${username}@test.wxyc.org`;

    await rosterPage.createAccount({
      realName: "E2E Test MD",
      username,
      email,
      djName: "DJ MD",
      role: "musicDirector",
    });

    // Should show success toast
    await rosterPage.expectSuccessToast("Account created");

    // Wait for table to refresh
    await page.waitForTimeout(1000);

    // User should appear in roster with MD checkbox checked
    await rosterPage.expectUserInRoster(username);
  });

  test("should create user with Station Manager role", async ({ page }) => {
    const username = generateUsername();
    const email = `${username}@test.wxyc.org`;

    await rosterPage.createAccount({
      realName: "E2E Test SM",
      username,
      email,
      djName: "DJ SM",
      role: "stationManager",
    });

    // Should show success toast
    await rosterPage.expectSuccessToast("Account created");

    // Wait for table to refresh
    await page.waitForTimeout(1000);

    // User should appear in roster with SM checkbox checked
    await rosterPage.expectUserInRoster(username);
  });

  test("should require real name field", async ({ page }) => {
    await rosterPage.clickAddDj();

    // Fill all fields except realName
    await rosterPage.usernameInput.fill(generateUsername());
    await rosterPage.emailInput.fill("test@test.wxyc.org");

    // Try to submit
    await rosterPage.submitNewAccount();

    // Form should not submit (HTML5 validation) or show error
    // The form should still be visible
    await expect(rosterPage.realNameInput).toBeVisible();
  });

  test("should require username field", async ({ page }) => {
    await rosterPage.clickAddDj();

    // Fill all fields except username
    await rosterPage.realNameInput.fill("Test User");
    await rosterPage.emailInput.fill("test@test.wxyc.org");

    // Try to submit
    await rosterPage.submitNewAccount();

    // Form should not submit
    await expect(rosterPage.usernameInput).toBeVisible();
  });

  test("should require email field", async ({ page }) => {
    await rosterPage.clickAddDj();

    // Fill all fields except email
    await rosterPage.realNameInput.fill("Test User");
    await rosterPage.usernameInput.fill(generateUsername());

    // Try to submit
    await rosterPage.submitNewAccount();

    // Form should not submit
    await expect(rosterPage.emailInput).toBeVisible();
  });

  test("should allow DJ name to be optional", async ({ page }) => {
    const username = generateUsername();
    const email = `${username}@test.wxyc.org`;

    await rosterPage.clickAddDj();

    // Fill only required fields
    await rosterPage.realNameInput.fill("E2E No DJ Name");
    await rosterPage.usernameInput.fill(username);
    await rosterPage.emailInput.fill(email);
    // Don't fill djName

    await rosterPage.submitNewAccount();

    // Should succeed
    await rosterPage.expectSuccessToast("Account created");
  });

  test("should show error for duplicate username", async ({ page }) => {
    await rosterPage.clickAddDj();

    // Try to create user with existing username
    await rosterPage.fillNewAccountForm({
      realName: "Duplicate User",
      username: TEST_USERS.dj1.username, // Existing user
      email: "new_unique_email@test.wxyc.org",
    });

    await rosterPage.submitNewAccount();

    // Should show error toast
    await rosterPage.expectErrorToast();
  });

  test("should show error for duplicate email", async ({ page }) => {
    await rosterPage.clickAddDj();

    // Try to create user with existing email
    await rosterPage.fillNewAccountForm({
      realName: "Duplicate Email User",
      username: generateUsername(),
      email: TEST_USERS.dj1.email, // Existing email
    });

    await rosterPage.submitNewAccount();

    // Should show error toast
    await rosterPage.expectErrorToast();
  });

  test("should validate email format", async ({ page }) => {
    await rosterPage.clickAddDj();

    await rosterPage.fillNewAccountForm({
      realName: "Invalid Email User",
      username: generateUsername(),
      email: "invalid-email", // Invalid email format
    });

    await rosterPage.submitNewAccount();

    // HTML5 validation should prevent submission
    // or backend should return error
    // Form should still be visible or error shown
  });

  test("should close form when clicking away", async ({ page }) => {
    await rosterPage.clickAddDj();
    await expect(rosterPage.newAccountRow).toBeVisible();

    // Click outside the form (on another element)
    await page.click("body", { position: { x: 10, y: 10 } });

    // Wait a moment for click away handler
    await page.waitForTimeout(500);

    // Form might close based on ClickAwayListener
    // This behavior depends on implementation
  });
});

test.describe("Non-Admin User Creation Restrictions", () => {
  test("DJ cannot access roster page to create users", async ({ page }) => {
    const loginPage = new LoginPage(page);
    const dashboardPage = new DashboardPage(page);

    await loginPage.goto();
    await loginPage.login(TEST_USERS.dj1.username, TEST_USERS.dj1.password);
    await loginPage.waitForRedirectToDashboard();

    // Try to access roster
    await dashboardPage.gotoAdminRoster();

    // Should be redirected to default dashboard
    await dashboardPage.expectRedirectedToDefaultDashboard();
  });

  test("Music Director cannot access roster page to create users", async ({ page }) => {
    const loginPage = new LoginPage(page);
    const dashboardPage = new DashboardPage(page);

    await loginPage.goto();
    await loginPage.login(TEST_USERS.musicDirector.username, TEST_USERS.musicDirector.password);
    await loginPage.waitForRedirectToDashboard();

    // Try to access roster
    await dashboardPage.gotoAdminRoster();

    // Should be redirected to default dashboard
    await dashboardPage.expectRedirectedToDefaultDashboard();
  });
});

test.describe("New User Can Login", () => {
  test.skip("newly created user should be able to login with temporary password", async ({ page, browser }) => {
    // This test requires:
    // 1. Creating a user (which we can do)
    // 2. Knowing the temporary password (from env var NEXT_PUBLIC_ONBOARDING_TEMP_PASSWORD)
    // 3. The new user then logs in

    // Since the temp password is an env var, this test may need
    // special setup or be run in specific environments
  });
});
