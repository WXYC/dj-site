import { test as setup, expect } from "@playwright/test";
import { TEST_USERS } from "./fixtures/auth.fixture";

const authDir = "e2e/.auth";

/**
 * Setup authentication state for Station Manager
 * Used by tests that require admin access
 */
setup("authenticate as station manager", async ({ page }) => {
  await page.goto("/login");
  await page.waitForSelector('input[name="username"]');

  await page.fill('input[name="username"]', TEST_USERS.stationManager.username);
  await page.fill('input[name="password"]', TEST_USERS.stationManager.password);
  await page.click('button[type="submit"]');

  // Wait for successful login
  await page.waitForURL((url) => !url.pathname.includes("/login"), {
    timeout: 15000,
  });

  // Verify we're authenticated
  await expect(page).not.toHaveURL(/\/login/);

  // Save storage state
  await page.context().storageState({ path: `${authDir}/stationManager.json` });
});

/**
 * Setup authentication state for Music Director
 */
setup("authenticate as music director", async ({ page }) => {
  await page.goto("/login");
  await page.waitForSelector('input[name="username"]');

  await page.fill('input[name="username"]', TEST_USERS.musicDirector.username);
  await page.fill('input[name="password"]', TEST_USERS.musicDirector.password);
  await page.click('button[type="submit"]');

  await page.waitForURL((url) => !url.pathname.includes("/login"), {
    timeout: 15000,
  });

  await expect(page).not.toHaveURL(/\/login/);
  await page.context().storageState({ path: `${authDir}/musicDirector.json` });
});

/**
 * Setup authentication state for DJ
 */
setup("authenticate as dj", async ({ page }) => {
  await page.goto("/login");
  await page.waitForSelector('input[name="username"]');

  await page.fill('input[name="username"]', TEST_USERS.dj1.username);
  await page.fill('input[name="password"]', TEST_USERS.dj1.password);
  await page.click('button[type="submit"]');

  await page.waitForURL((url) => !url.pathname.includes("/login"), {
    timeout: 15000,
  });

  await expect(page).not.toHaveURL(/\/login/);
  await page.context().storageState({ path: `${authDir}/dj.json` });
});

/**
 * Setup authentication state for Member (no org role)
 */
setup("authenticate as member", async ({ page }) => {
  await page.goto("/login");
  await page.waitForSelector('input[name="username"]');

  await page.fill('input[name="username"]', TEST_USERS.member.username);
  await page.fill('input[name="password"]', TEST_USERS.member.password);
  await page.click('button[type="submit"]');

  await page.waitForURL((url) => !url.pathname.includes("/login"), {
    timeout: 15000,
  });

  await expect(page).not.toHaveURL(/\/login/);
  await page.context().storageState({ path: `${authDir}/member.json` });
});
