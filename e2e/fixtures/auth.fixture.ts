import { test as base, expect, Page } from "@playwright/test";
import { MOCK_USERS, MockUserKey, MockUser } from "@/lib/test-utils/fixtures";

/**
 * Temporary password used for admin-created users.
 * Must match NEXT_PUBLIC_ONBOARDING_TEMP_PASSWORD in .env.local.
 */
export const TEMP_PASSWORD = process.env.NEXT_PUBLIC_ONBOARDING_TEMP_PASSWORD || "temppass123";

/** Re-export shared mock users for e2e convenience. */
export const TEST_USERS = MOCK_USERS;
export type TestUserKey = MockUserKey;
export type TestUser = MockUser;

export async function login(
  page: Page,
  user: TestUser | { username: string; password: string }
): Promise<void> {
  await page.goto("/login");
  await page.waitForSelector('input[name="username"]');
  await page.fill('input[name="username"]', user.username);
  await page.fill('input[name="password"]', user.password);
  await page.click('button[type="submit"]');
  await page.waitForURL((url) => !url.pathname.includes("/login"), {
    timeout: 10000,
  });
}

export async function logout(page: Page): Promise<void> {
  const logoutButton = page.locator('button:has-text("Logout"), a:has-text("Logout"), [aria-label="Logout"]');

  if (await logoutButton.isVisible()) {
    await logoutButton.click();
    await page.waitForURL("**/login**");
  }
}

export async function isAuthenticated(page: Page): Promise<boolean> {
  await page.goto("/dashboard");
  const currentUrl = page.url();
  return !currentUrl.includes("/login");
}

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

export async function clearAuthCookies(page: Page): Promise<void> {
  const context = page.context();
  await context.clearCookies();
}

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

const PORT_RANGE_START = 8080;
const PORT_RANGE_SIZE = 5;

/**
 * Discover the auth service base URL. Checks environment variables first,
 * then probes a range of ports starting at {@link PORT_RANGE_START}.
 * Throws if no reachable port is found.
 */
async function getAuthServiceBaseUrl(): Promise<string> {
  const authUrl = process.env.NEXT_PUBLIC_BETTER_AUTH_URL;
  if (authUrl) {
    // The env var includes the /auth path (e.g., "http://localhost:8084/auth").
    // Strip it to get the service base URL for direct HTTP calls.
    return authUrl.replace(/\/auth\/?$/, "");
  }

  const authPort = process.env.E2E_AUTH_PORT;
  if (authPort) {
    return `http://localhost:${authPort}`;
  }

  for (let i = 0; i < PORT_RANGE_SIZE; i++) {
    const port = PORT_RANGE_START + i;
    try {
      const response = await fetch(`http://localhost:${port}/healthcheck`, {
        method: "GET",
        signal: AbortSignal.timeout(1000),
      });
      if (response.ok) {
        return `http://localhost:${port}`;
      }
    } catch {
      // Port not available, try next
    }
  }

  throw new Error(
    `Auth service not found on ports ${PORT_RANGE_START}-${PORT_RANGE_START + PORT_RANGE_SIZE - 1}. ` +
    `Set NEXT_PUBLIC_BETTER_AUTH_URL or E2E_AUTH_PORT.`
  );
}

/**
 * Fetch verification token from test endpoint (for password reset testing).
 * Requires Backend-Service to be running with NODE_ENV !== 'production'.
 */
export async function getVerificationToken(identifier: string): Promise<{ token: string; expiresAt: string } | null> {
  const baseUrl = await getAuthServiceBaseUrl();

  try {
    const response = await fetch(`${baseUrl}/auth/test/verification-token?identifier=${encodeURIComponent(identifier)}`);
    if (!response.ok) {
      return null;
    }
    return await response.json();
  } catch (error) {
    console.error("Failed to fetch verification token:", error);
    return null;
  }
}

/**
 * Revoke all sessions for a user via better-auth's revoke-sessions endpoint.
 * Requires an active session cookie (admin-level access).
 *
 * For unit tests, prefer better-auth's getTestInstance() and client.revokeSessions().
 * See: https://better-auth.com/docs/concepts/session-management
 */
export async function revokeUserSessions(sessionCookie: string): Promise<boolean> {
  const baseUrl = await getAuthServiceBaseUrl();

  try {
    const response = await fetch(`${baseUrl}/auth/revoke-sessions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: sessionCookie,
      },
    });
    return response.ok;
  } catch (error) {
    console.error("Failed to revoke sessions:", error);
    return false;
  }
}

export { expect };
