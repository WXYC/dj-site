import { test, expect, TEST_USERS } from "../../fixtures/auth.fixture";
import { LoginPage } from "../../pages/login.page";
import { DashboardPage } from "../../pages/dashboard.page";
import { OnboardingPage } from "../../pages/onboarding.page";

test.describe("New User Onboarding", () => {
  // Onboarding tests do manual logins and must run sequentially
  test.describe.configure({ mode: 'serial' });
  let loginPage: LoginPage;
  let onboardingPage: OnboardingPage;
  let dashboardPage: DashboardPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    onboardingPage = new OnboardingPage(page);
    dashboardPage = new DashboardPage(page);
  });

  test.describe("Incomplete User Login", () => {
    test.skip("should redirect incomplete user to onboarding after login", async ({ page }) => {
      // This test requires the test_incomplete user to exist in the database
      // with missing realName and djName fields

      const user = TEST_USERS.incomplete;
      await loginPage.goto();
      await loginPage.login(user.username, user.password);

      // Should be redirected to onboarding/newuser page
      await loginPage.waitForRedirectToOnboarding();
      expect(await onboardingPage.isOnOnboardingPage()).toBe(true);
    });

    test.skip("should show onboarding form with required fields", async ({ page }) => {
      // Login as incomplete user
      const user = TEST_USERS.incomplete;
      await loginPage.goto();
      await loginPage.login(user.username, user.password);

      await loginPage.waitForRedirectToOnboarding();
      await onboardingPage.waitForPage();

      // Verify form fields are visible
      await onboardingPage.expectFormVisible();
    });
  });

  test.describe("Onboarding Form Validation", () => {
    // These tests assume we can access the onboarding page directly
    // or are on it after login as an incomplete user

    test.skip("should require all fields to be filled", async ({ page }) => {
      // Navigate to onboarding page (requires incomplete user login)
      const user = TEST_USERS.incomplete;
      await loginPage.goto();
      await loginPage.login(user.username, user.password);
      await loginPage.waitForRedirectToOnboarding();

      // Submit button should be disabled initially
      await onboardingPage.expectSubmitButtonDisabled();

      // Fill only some fields
      await onboardingPage.fillRequiredField("realName", "Test User");
      await page.waitForTimeout(300);

      // Should still be disabled
      await onboardingPage.expectSubmitButtonDisabled();
    });

    test.skip("should validate password requirements", async ({ page }) => {
      const user = TEST_USERS.incomplete;
      await loginPage.goto();
      await loginPage.login(user.username, user.password);
      await loginPage.waitForRedirectToOnboarding();

      // Fill basic fields
      await onboardingPage.fillRequiredField("realName", "Test User");
      await onboardingPage.fillRequiredField("djName", "DJ Test");

      // Enter weak password
      await onboardingPage.fillRequiredField("password", "weak");
      await onboardingPage.fillRequiredField("confirmPassword", "weak");

      await page.waitForTimeout(300);

      // Should be disabled due to password requirements
      await onboardingPage.expectSubmitButtonDisabled();
    });

    test.skip("should require password confirmation to match", async ({ page }) => {
      const user = TEST_USERS.incomplete;
      await loginPage.goto();
      await loginPage.login(user.username, user.password);
      await loginPage.waitForRedirectToOnboarding();

      // Fill all fields but with mismatched passwords
      await onboardingPage.fillOnboardingForm({
        realName: "Test User",
        djName: "DJ Test",
        password: "ValidPassword1",
        confirmPassword: "DifferentPassword1",
      });

      await page.waitForTimeout(300);

      // Should be disabled due to password mismatch
      await onboardingPage.expectSubmitButtonDisabled();
    });

    test.skip("should enable submit when all validations pass", async ({ page }) => {
      const user = TEST_USERS.incomplete;
      await loginPage.goto();
      await loginPage.login(user.username, user.password);
      await loginPage.waitForRedirectToOnboarding();

      // Fill all fields correctly
      await onboardingPage.fillOnboardingForm({
        realName: "Test User",
        djName: "DJ Test",
        password: "ValidPassword1",
        confirmPassword: "ValidPassword1",
      });

      await page.waitForTimeout(300);

      // Should now be enabled
      await onboardingPage.expectSubmitButtonEnabled();
    });
  });

  test.describe("Onboarding Completion", () => {
    test.skip("should redirect to dashboard after successful onboarding", async ({ page }) => {
      const user = TEST_USERS.incomplete;
      await loginPage.goto();
      await loginPage.login(user.username, user.password);
      await loginPage.waitForRedirectToOnboarding();

      // Complete onboarding
      await onboardingPage.completeOnboarding({
        realName: "Test User",
        djName: "DJ Test",
        password: "ValidPassword1",
      });

      // Should show success toast
      await onboardingPage.expectSuccessToast("Profile updated");

      // Should redirect to dashboard
      await onboardingPage.expectRedirectToDashboard();
    });

    test.skip("should show error on failed onboarding submission", async ({ page }) => {
      const user = TEST_USERS.incomplete;
      await loginPage.goto();
      await loginPage.login(user.username, user.password);
      await loginPage.waitForRedirectToOnboarding();

      // Try to submit with server-side invalid data
      // This depends on what the server considers invalid
      await onboardingPage.fillOnboardingForm({
        realName: "", // Empty after trim might fail server-side
        djName: "DJ Test",
        password: "ValidPassword1",
      });

      await onboardingPage.submitForm();

      // May show error toast if server validation fails
      // Or form validation prevents submission
    });

    test.skip("should allow going back to login from onboarding", async ({ page }) => {
      const user = TEST_USERS.incomplete;
      await loginPage.goto();
      await loginPage.login(user.username, user.password);
      await loginPage.waitForRedirectToOnboarding();

      // Click back button
      await onboardingPage.goBackToLogin();

      // Should be on login page
      expect(await loginPage.isOnLoginPage()).toBe(true);
    });
  });

  test.describe("Onboarding for Admin-Created Users", () => {
    test.skip("should handle onboarding for newly created accounts", async ({ page }) => {
      // This test would require:
      // 1. Admin creates a new user with temporary password
      // 2. New user logs in with temporary password
      // 3. New user completes onboarding

      // This is a complex integration test that requires
      // admin functionality to work first
    });
  });
});

test.describe("Complete User Bypass", () => {
  test("should not redirect complete user to onboarding", async ({ page }) => {
    // Complete users (with realName and djName) should go directly to dashboard
    const loginPage = new LoginPage(page);
    const dashboardPage = new DashboardPage(page);

    await loginPage.goto();
    await loginPage.login(TEST_USERS.dj1.username, TEST_USERS.dj1.password);

    // Should go directly to dashboard, not onboarding
    await loginPage.waitForRedirectToDashboard();
    await dashboardPage.expectOnDashboard();
  });
});
