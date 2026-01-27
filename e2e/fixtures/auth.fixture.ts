import { test as base, expect, Page } from "@playwright/test";

/**
 * Test users seeded in Backend-Service database
 * These users must exist in dev_env/seed_db.sql
 */
export const TEST_USERS = {
  member: {
    username: "test_member",
    password: "testpassword123",
    email: "test_member@wxyc.org",
    role: "member",
    realName: "Test Member",
    djName: "Test Member DJ",
  },
  dj1: {
    username: "test_dj1",
    password: "testpassword123",
    email: "test_dj1@wxyc.org",
    role: "dj",
    realName: "Test DJ 1",
    djName: "Test dj1",
  },
  dj2: {
    username: "test_dj2",
    password: "testpassword123",
    email: "test_dj2@wxyc.org",
    role: "dj",
    realName: "Test DJ 2",
    djName: "Test dj2",
  },
  musicDirector: {
    username: "test_music_director",
    password: "testpassword123",
    email: "test_music_director@wxyc.org",
    role: "musicDirector",
    realName: "Test Music Director",
    djName: "Test MD",
  },
  stationManager: {
    username: "test_station_manager",
    password: "testpassword123",
    email: "test_station_manager@wxyc.org",
    role: "stationManager",
    realName: "Test Station Manager",
    djName: "Test SM",
  },
  incomplete: {
    username: "test_incomplete",
    password: "testpassword123",
    email: "test_incomplete@wxyc.org",
    role: "dj",
    realName: "", // Missing required field
    djName: "", // Missing required field
  },
  deletable: {
    username: "test_deletable_user",
    password: "testpassword123",
    email: "test_deletable@wxyc.org",
    role: "dj",
    realName: "Test Deletable",
    djName: "Deletable DJ",
  },
  promotable: {
    username: "test_promotable_user",
    password: "testpassword123",
    email: "test_promotable@wxyc.org",
    role: "member",
    realName: "Test Promotable",
    djName: "Promotable DJ",
  },
  demotableSm: {
    username: "test_demotable_sm",
    password: "testpassword123",
    email: "test_demotable_sm@wxyc.org",
    role: "stationManager",
    realName: "Test Demotable SM",
    djName: "Demotable SM",
  },
} as const;

export type TestUserKey = keyof typeof TEST_USERS;
export type TestUser = (typeof TEST_USERS)[TestUserKey];

/**
 * Login helper - performs login via UI
 */
export async function login(
  page: Page,
  user: TestUser | { username: string; password: string }
): Promise<void> {
  await page.goto("/login");

  // Wait for the login form to be ready
  await page.waitForSelector('input[name="username"]');

  // Fill in credentials
  await page.fill('input[name="username"]', user.username);
  await page.fill('input[name="password"]', user.password);

  // Submit the form
  await page.click('button[type="submit"]');

  // Wait for navigation away from login page
  await page.waitForURL((url) => !url.pathname.includes("/login"), {
    timeout: 10000,
  });
}

/**
 * Logout helper - performs logout via UI
 */
export async function logout(page: Page): Promise<void> {
  // Look for logout button/link in the UI
  // This may need adjustment based on actual logout implementation
  const logoutButton = page.locator('button:has-text("Logout"), a:has-text("Logout"), [aria-label="Logout"]');

  if (await logoutButton.isVisible()) {
    await logoutButton.click();
    await page.waitForURL("**/login**");
  }
}

/**
 * Check if user is currently authenticated
 */
export async function isAuthenticated(page: Page): Promise<boolean> {
  // Check if we can access a protected page
  const response = await page.goto("/dashboard");
  const currentUrl = page.url();
  return !currentUrl.includes("/login");
}

/**
 * Get session cookies from the page
 */
export async function getSessionCookies(page: Page): Promise<{ name: string; value: string }[]> {
  const context = page.context();
  const cookies = await context.cookies();
  return cookies.filter(
    (cookie) =>
      cookie.name.includes("session") ||
      cookie.name.includes("auth") ||
      cookie.name.includes("better-auth")
  );
}

/**
 * Clear all auth cookies
 */
export async function clearAuthCookies(page: Page): Promise<void> {
  const context = page.context();
  await context.clearCookies();
}

/**
 * Extended test fixture with auth helpers
 */
export const test = base.extend<{
  loginAs: (userKey: TestUserKey) => Promise<void>;
  loginWithCredentials: (username: string, password: string) => Promise<void>;
  logoutUser: () => Promise<void>;
  isLoggedIn: () => Promise<boolean>;
}>({
  loginAs: async ({ page }, use) => {
    await use(async (userKey: TestUserKey) => {
      const user = TEST_USERS[userKey];
      await login(page, user);
    });
  },

  loginWithCredentials: async ({ page }, use) => {
    await use(async (username: string, password: string) => {
      await login(page, { username, password });
    });
  },

  logoutUser: async ({ page }, use) => {
    await use(async () => {
      await logout(page);
    });
  },

  isLoggedIn: async ({ page }, use) => {
    await use(async () => {
      return isAuthenticated(page);
    });
  },
});

export { expect };
