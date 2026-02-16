import { test as setup, expect } from "@playwright/test";
import { TEST_USERS } from "./fixtures/auth.fixture";
import path from "path";
import fs from "fs";

const authDir = path.join(__dirname, ".auth");

// Ensure auth directory exists
if (!fs.existsSync(authDir)) {
  fs.mkdirSync(authDir, { recursive: true });
}

/**
 * Helper to perform login and save auth state
 */
async function performLogin(
  page: import("@playwright/test").Page,
  username: string,
  password: string,
  statePath: string
) {
  await page.goto("/login");
  await page.waitForSelector('input[name="username"]');

  await page.fill('input[name="username"]', username);
  await page.fill('input[name="password"]', password);

  // Click submit and wait for either:
  // 1. URL changes (successful login)
  // 2. Error toast appears (failed login)
  await page.click('button[type="submit"]');

  // Wait for navigation away from login page
  try {
    await page.waitForURL((url) => !url.pathname.includes("/login"), {
      timeout: 15000,
    });
  } catch {
    // If navigation didn't happen, check for error messages
    const errorToast = await page
      .locator('[role="alert"], .toast-error, [data-sonner-toast]')
      .first()
      .textContent()
      .catch(() => null);
    const pageContent = await page.content();

    throw new Error(
      `Login failed for user "${username}". ` +
        `Error toast: ${errorToast || "none"}. ` +
        `Current URL: ${page.url()}. ` +
        `Page contains 'error': ${pageContent.toLowerCase().includes("error")}`
    );
  }

  // Verify we're authenticated
  await expect(page).not.toHaveURL(/\/login/);

  // Save storage state
  await page.context().storageState({ path: statePath });
}

/**
 * Setup authentication state for Station Manager
 * Used by tests that require admin access
 */
setup("authenticate as station manager", async ({ page }) => {
  await performLogin(
    page,
    TEST_USERS.stationManager.username,
    TEST_USERS.stationManager.password,
    `${authDir}/stationManager.json`
  );
});

/**
 * Setup authentication state for Music Director
 */
setup("authenticate as music director", async ({ page }) => {
  await performLogin(
    page,
    TEST_USERS.musicDirector.username,
    TEST_USERS.musicDirector.password,
    `${authDir}/musicDirector.json`
  );
});

/**
 * Setup authentication state for DJ (dj1)
 * Used by tests that don't invalidate the session (logout tests use this)
 */
setup("authenticate as dj", async ({ page }) => {
  await performLogin(
    page,
    TEST_USERS.dj1.username,
    TEST_USERS.dj1.password,
    `${authDir}/dj.json`
  );
});

/**
 * Setup authentication state for DJ2
 * Used by RBAC tests to avoid conflicts with logout tests that use dj1
 */
setup("authenticate as dj2", async ({ page }) => {
  await performLogin(
    page,
    TEST_USERS.dj2.username,
    TEST_USERS.dj2.password,
    `${authDir}/dj2.json`
  );
});

/**
 * Setup authentication state for Member (no org role)
 */
setup("authenticate as member", async ({ page }) => {
  await performLogin(
    page,
    TEST_USERS.member.username,
    TEST_USERS.member.password,
    `${authDir}/member.json`
  );
});
