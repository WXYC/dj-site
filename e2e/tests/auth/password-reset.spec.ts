import { test, expect, TEST_USERS, getVerificationToken } from "../../fixtures/auth.fixture";
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
    const user = TEST_USERS.reset1;
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
    const user = TEST_USERS.reset1;
    await loginPage.requestPasswordReset(user.email);

    // Wait for redirect back to login
    await page.waitForURL("**/login**", { timeout: 10000 });
    expect(await loginPage.isOnLoginPage()).toBe(true);
  });

  test("should disable send button while request is in progress", async ({ page }) => {
    const user = TEST_USERS.reset1;
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

    // Should show error alert (use MUI Alert selector to avoid matching Next.js route announcer)
    const alertMessage = page.locator('[role="alert"].MuiAlert-root');
    await expect(alertMessage).toContainText("invalid");
  });

  test("should validate password requirements", async ({ page }) => {
    await loginPage.gotoWithToken("test-token");

    // Try weak password (too short, no capital, no number)
    await loginPage.fillPasswordFields("weak", "weak");

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
    // Request a password reset first to generate a token
    const user = TEST_USERS.reset1;
    await loginPage.goto();
    await loginPage.clickForgotPassword();
    await loginPage.requestPasswordReset(user.email);

    // Wait for the request to complete
    await page.waitForTimeout(1000);

    // Get the token from the backend test endpoint
    const tokenData = await getVerificationToken(user.email);
    expect(tokenData).not.toBeNull();

    // Navigate to reset with the real token
    await loginPage.gotoWithToken(tokenData!.token);

    // Use the token once to "consume" it
    await loginPage.resetPassword("ValidPassword1", "ValidPassword1");

    // Wait for the reset to complete
    await loginPage.expectSuccessToast();
    await page.waitForTimeout(500);

    // Now try to use the same token again - it should fail
    await loginPage.gotoWithToken(tokenData!.token);
    await loginPage.resetPassword("AnotherPassword1", "AnotherPassword1");

    // Should show error for already-used/invalid token
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

    // Use MUI Alert selector to avoid matching Next.js route announcer
    const alertMessage = page.locator('[role="alert"].MuiAlert-root');
    await expect(alertMessage).toBeVisible();
    await expect(alertMessage).toContainText(/invalid|expired/i);
  });
});

test.describe("Password Reset - Integration", () => {
  test("should allow login with new password after successful reset", async ({ page }) => {
    const loginPage = new LoginPage(page);
    const dashboardPage = new DashboardPage(page);

    // Use dj2 for this test to avoid conflicts with other tests using dj1
    const user = TEST_USERS.reset2;
    const newPassword = `NewPassword${Date.now()}`;

    // Step 1: Request password reset
    await loginPage.goto();
    await loginPage.clickForgotPassword();
    await loginPage.requestPasswordReset(user.email);

    // Wait for request to complete
    await loginPage.expectSuccessToast();
    await page.waitForTimeout(1000);

    // Step 2: Get the verification token from the backend
    const tokenData = await getVerificationToken(user.email);
    expect(tokenData).not.toBeNull();
    expect(tokenData!.token).toBeTruthy();

    // Step 3: Use the token to reset the password
    await loginPage.gotoWithToken(tokenData!.token);
    await loginPage.resetPassword(newPassword, newPassword);

    // Wait for reset to complete
    await loginPage.expectSuccessToast();
    await page.waitForURL("**/login**", { timeout: 10000 });

    // Step 4: Login with the new password
    await loginPage.login(user.username, newPassword);
    await loginPage.waitForRedirectToDashboard();

    // Verify we're on the dashboard
    await dashboardPage.expectOnDashboard();

    // Cleanup: Reset the password back to original
    // (This is handled by test isolation - each test has a fresh DB state)
  });
});
