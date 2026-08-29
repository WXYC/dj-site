import { test as base, expect, Page } from "@playwright/test";
import { MOCK_USERS, MockUserKey, MockUser } from "../../tests/fixtures/fixtures";

/** Re-export shared mock users for e2e convenience. */
export const TEST_USERS = MOCK_USERS;
export type TestUserKey = MockUserKey;
export type TestUser = MockUser;

/**
 * Identity data for the go-live takeover spec's dedicated pair
 * (e2e/tests/flowsheet/go-live-takeover.spec.ts). Data only — declared here
 * rather than in auth.setup.ts (which owns provisioning) so the spec can
 * import the username/djName/statePath fields it needs without importing a
 * file whose top-level module code registers Playwright `setup()` tests.
 *
 * Not in MOCK_USERS / dev_env/setup-e2e-test-users.ts: that spec is the only
 * one in the suite allowed to click "End Existing Show", so it needs a pair
 * nothing else touches, provisioned via the live admin roster the same way
 * as the classic-preference identities in auth.setup.ts.
 */
export const TAKEOVER_DJ_A = {
  username: "test_takeover_a",
  password: "TestTakeoverA1",
  email: "test_takeover_a@wxyc.org",
  realName: "Test Takeover A",
  djName: "Test Takeover A",
  role: "dj" as const,
  stateFile: "takeoverDjA.json",
};

export const TAKEOVER_DJ_B = {
  username: "test_takeover_b",
  password: "TestTakeoverB1",
  email: "test_takeover_b@wxyc.org",
  realName: "Test Takeover B",
  djName: "Test Takeover B",
  role: "dj" as const,
  stateFile: "takeoverDjB.json",
};

export async function login(
  page: Page,
  user: TestUser | { username: string; password: string }
): Promise<void> {
  await page.goto("/login");

  // The login page defaults to the OTP email form. Switch to password login.
  const passwordLink = page.getByRole("button", {
    name: "Sign in with password instead",
  });
  await passwordLink.waitFor({ state: "visible", timeout: 15000 });
  // The Redux dispatch from the click can occasionally fail to trigger a
  // re-render on slow CI runners. Retry the click if the form doesn't swap.
  const usernameInput = page.locator('input[name="username"]');
  for (let attempt = 0; attempt < 3; attempt++) {
    await passwordLink.click();
    try {
      await usernameInput.waitFor({ state: "visible", timeout: 5000 });
      break;
    } catch {
      if (attempt === 2) {
        await usernameInput.waitFor({ state: "visible", timeout: 10000 });
      }
    }
  }
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
export async function getAuthServiceBaseUrl(): Promise<string> {
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

  // Provision + requestPasswordReset may commit slightly after the UI toast.
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const response = await fetch(
        `${baseUrl}/auth/test/verification-token?identifier=${encodeURIComponent(identifier)}`
      );
      if (response.ok) {
        return await response.json();
      }
    } catch (error) {
      console.error("Failed to fetch verification token:", error);
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  return null;
}

/**
 * Complete new-DJ onboarding via the invite setup token (primary provisioning flow).
 */
export async function completeOnboardingWithInviteToken(
  page: Page,
  email: string,
  password: string,
  // The roster's own createAccount({ realName, djName }) only seeds a
  // suggestion the onboarding form pre-fills; it is NOT the account's final
  // value. Onboarding always makes the final choice, so a caller whose
  // identity's realName/djName is load-bearing (an assertion reads it, or —
  // as here — two identities must be distinguishable by it) must pass its
  // own values rather than trust the filler fallback below. An explicit
  // override always wins over whatever the form pre-filled, since a caller
  // that named a value did so because it needs exactly that value, not "any
  // non-empty one".
  overrides?: { realName?: string; djName?: string }
): Promise<void> {
  const tokenData = await getVerificationToken(email);
  if (!tokenData?.token) {
    throw new Error(`No setup token found for ${email}`);
  }

  await page.goto(`/onboarding?token=${encodeURIComponent(tokenData.token)}`);
  await page.waitForURL(/\/onboarding/, { timeout: 15000 });
  await page.locator('input[name="password"]').waitFor({ state: "visible", timeout: 20000 });

  const realNameInput = page.locator('input[name="realName"]');
  if (await realNameInput.isVisible()) {
    const existingRealName = await realNameInput.inputValue();
    if (overrides?.realName !== undefined) {
      await realNameInput.fill(overrides.realName);
    } else if (!existingRealName.trim()) {
      await realNameInput.fill("E2E Test User");
    }
  }

  const djNameInput = page.locator('input[name="djName"]');
  if (await djNameInput.isVisible()) {
    const existingDjName = await djNameInput.inputValue();
    if (overrides?.djName !== undefined) {
      await djNameInput.fill(overrides.djName);
    } else if (!existingDjName.trim()) {
      await djNameInput.fill("E2E DJ");
    }
  }

  await page.fill('input[name="password"]', password);
  await page.fill('input[name="confirmPassword"]', password);
  await expect(page.getByRole("button", { name: "Submit" })).toBeEnabled({
    timeout: 10000,
  });
  await page.getByRole("button", { name: "Submit" }).click();
  await page.waitForURL((url) => url.pathname.includes("/dashboard"), {
    timeout: 20000,
  });
}

/**
 * Reset the seeded test_incomplete user (session onboarding E2E).
 * Requires Backend-Service with NODE_ENV development or test.
 */
export async function resetIncompleteTestUser(
  userId = "test-incomplete-id-0000000000001"
): Promise<void> {
  const baseUrl = await getAuthServiceBaseUrl();
  const response = await fetch(`${baseUrl}/auth/test/reset-incomplete-user`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId }),
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(
      `Failed to reset incomplete test user (${response.status}): ${body}`
    );
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

/**
 * Mark an admin-created user as having completed onboarding.
 * Requires Backend-Service to be running with NODE_ENV !== 'production'.
 */
export async function confirmUser(userId: string): Promise<boolean> {
  const baseUrl = await getAuthServiceBaseUrl();

  try {
    const response = await fetch(`${baseUrl}/auth/test/confirm-user`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    return response.ok;
  } catch (error) {
    console.error("Failed to confirm user:", error);
    return false;
  }
}

export { expect };
