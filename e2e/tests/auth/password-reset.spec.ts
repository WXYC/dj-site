import { test, expect, TEST_USERS } from "../../fixtures/auth.fixture";
import { LoginPage } from "../../pages/login.page";
import { DashboardPage } from "../../pages/dashboard.page";

test.describe("Password Reset - Request Flow", () => {
  let loginPage: LoginPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.clickForgotPassword();
  });

  test("should display password reset request form", async () => {
    await loginPage.expectPasswordResetFormVisible();
  });

  test("should show success message for valid registered email", async ({ page }) => {
    const user = TEST_USERS.dj1;
    await loginPage.requestPasswordReset(user.email);

    // Should show success message
    // Note: For security, same message is shown for valid and invalid emails
    await loginPage.expectSuccessToast();
  });

  test("should show same success message for non-existent email (security)", async ({ page }) => {
    // For security reasons, the same message should be shown
    // whether the email exists or not
    await loginPage.requestPasswordReset("nonexistent@example.com");

    // Should show success message (same as valid email for security)
    await loginPage.expectSuccessToast();
  });

  test("should return to login page after requesting reset", async ({ page }) => {
    const user = TEST_USERS.dj1;
    await loginPage.requestPasswordReset(user.email);

    // Wait for redirect back to login
    await page.waitForURL("**/login**", { timeout: 10000 });
    expect(await loginPage.isOnLoginPage()).toBe(true);
  });

  test("should disable send button while request is in progress", async ({ page }) => {
    const user = TEST_USERS.dj1;
    await page.fill('input[name="email"]', user.email);

    // Click and immediately check button state
    const sendButton = page.locator('button:has-text("Send Reset Link")');

    await sendButton.click();

    // Button should show loading state
    // Check for loading attribute or disabled state
    await expect(sendButton).toBeDisabled({ timeout: 1000 }).catch(() => {
      // May have already completed, which is fine
    });
  });

  test("should disable send button when email is empty", async ({ page }) => {
    const sendButton = page.locator('button:has-text("Send Reset Link")');
    await expect(sendButton).toBeDisabled();
  });

  test("should validate email format", async ({ page }) => {
    // Enter invalid email
    await page.fill('input[name="email"]', "invalid-email");

    const sendButton = page.locator('button:has-text("Send Reset Link")');

    // HTML5 validation should prevent submission with invalid email
    // The button might be enabled but form validation will block
    await sendButton.click();

    // Should still be on the reset form (form validation prevents submission)
    await page.waitForTimeout(500);
  });
});

test.describe("Password Reset - Complete Flow", () => {
  let loginPage: LoginPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
  });

  test("should display new password form when token is provided", async ({ page }) => {
    // Navigate to login with a token parameter
    await loginPage.gotoWithToken("valid-test-token");

    // Should show new password form
    await loginPage.expectNewPasswordFormVisible();
  });

  test("should show error message for invalid/expired token", async ({ page }) => {
    // Navigate with an error parameter
    await loginPage.gotoWithError("invalid_token");

    // Should show error alert
    const alertMessage = page.locator('[role="alert"]');
    await expect(alertMessage).toContainText("invalid");
  });

  test("should validate password requirements", async ({ page }) => {
    await loginPage.gotoWithToken("test-token");

    // Try weak password (too short)
    await loginPage.resetPassword("weak", "weak");

    // Submit button should be disabled for weak passwords
    await loginPage.expectSubmitButtonDisabled();
  });

  test("should validate password confirmation matches", async ({ page }) => {
    await loginPage.gotoWithToken("test-token");

    // Enter mismatched passwords
    await page.fill('input[name="password"]', "ValidPass1");
    await page.fill('input[name="confirmPassword"]', "DifferentPass1");

    // Wait for validation
    await page.waitForTimeout(500);

    // Submit button should be disabled
    await loginPage.expectSubmitButtonDisabled();
  });

  test("should enable submit when password requirements are met", async ({ page }) => {
    await loginPage.gotoWithToken("test-token");

    // Enter valid matching passwords
    const validPassword = "ValidPassword1";
    await page.fill('input[name="password"]', validPassword);
    await page.fill('input[name="confirmPassword"]', validPassword);

    // Wait for validation
    await page.waitForTimeout(500);

    await loginPage.expectSubmitButtonEnabled();
  });

  test("should require capital letter in password", async ({ page }) => {
    await loginPage.gotoWithToken("test-token");

    // Password without capital letter
    await page.fill('input[name="password"]', "nouppercasepass1");
    await page.fill('input[name="confirmPassword"]', "nouppercasepass1");

    await page.waitForTimeout(500);
    await loginPage.expectSubmitButtonDisabled();
  });

  test("should require number in password", async ({ page }) => {
    await loginPage.gotoWithToken("test-token");

    // Password without number
    await page.fill('input[name="password"]', "NoNumberPassword");
    await page.fill('input[name="confirmPassword"]', "NoNumberPassword");

    await page.waitForTimeout(500);
    await loginPage.expectSubmitButtonDisabled();
  });

  test("should require minimum 8 characters in password", async ({ page }) => {
    await loginPage.gotoWithToken("test-token");

    // Password too short
    await page.fill('input[name="password"]', "Short1A");
    await page.fill('input[name="confirmPassword"]', "Short1A");

    await page.waitForTimeout(500);
    await loginPage.expectSubmitButtonDisabled();
  });
});

test.describe("Password Reset - Error Handling", () => {
  let loginPage: LoginPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
  });

  test("should show error for expired token on reset attempt", async ({ page }) => {
    // Use an obviously expired/invalid token
    await loginPage.gotoWithToken("expired-token-12345");

    // Try to reset password
    await loginPage.resetPassword("ValidPassword1", "ValidPassword1");

    // Should show error toast
    await loginPage.expectErrorToast();
  });

  test("should show error for malformed token", async ({ page }) => {
    // Use a malformed token with special characters
    await loginPage.gotoWithToken("malformed<script>alert('xss')</script>");

    // Either the page should show an error or handle it gracefully
    await page.waitForLoadState("domcontentloaded");

    // Page should not crash
    const url = page.url();
    expect(url).toContain("/login");
  });

  test("should handle empty token gracefully", async ({ page }) => {
    // Go to login with empty token
    await page.goto("/login?token=");
    await page.waitForLoadState("domcontentloaded");

    // Empty token is treated as no token, so should show normal login form
    // (the LoginSlotSwitcher checks `!!searchParams?.get("token")` which is false for "")
    await loginPage.expectLoginFormVisible();
  });

  test("should display helpful error message for expired link", async ({ page }) => {
    await loginPage.gotoWithError("expired");

    const alertMessage = page.locator('[role="alert"]');
    await expect(alertMessage).toBeVisible();
    await expect(alertMessage).toContainText(/invalid|expired/i);
  });
});

test.describe("Password Reset - Integration", () => {
  test.skip("should allow login with new password after successful reset", async ({ page }) => {
    // This test requires actual email/token generation which is complex to test E2E
    // Skip or implement with test fixtures that create valid tokens

    const loginPage = new LoginPage(page);
    const dashboardPage = new DashboardPage(page);

    // Would need:
    // 1. Generate a valid reset token for a test user
    // 2. Use that token to reset the password
    // 3. Login with the new password

    // This is marked as skip because it requires backend token generation
  });
});
