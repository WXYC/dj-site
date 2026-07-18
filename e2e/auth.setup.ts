import { test as setup, expect, request } from "@playwright/test";
import { TEST_USERS, getAuthServiceBaseUrl } from "./fixtures/auth.fixture";
import crypto from "crypto";
import path from "path";
import fs from "fs";

const authDir = path.join(__dirname, ".auth");

// Ensure auth directory exists
if (!fs.existsSync(authDir)) {
  fs.mkdirSync(authDir, { recursive: true });
}

// Bumping this discards every persisted session on the next run even when
// credentials are unchanged — the manual escape hatch for a login-flow change
// that silently invalidates old storage states.
const SESSION_CACHE_SALT = "1";

// A persisted storageState is only reusable against the same seeded users, so
// the key must rotate whenever those users change. We fingerprint the fixture
// *source* that declares them — not the credential values — which gives a
// strict superset of that guarantee (any username, password, OR user-set edit
// changes the file bytes) without ever routing a secret-shaped value through a
// hash. The users are declared in tests/fixtures/fixtures.ts and re-exported
// here as TEST_USERS; if that source starts pulling credentials from another
// file, add its path below. The key does NOT prove the session row still
// exists server-side (a reseeded database drops it) — persistedSessionIsUsable
// covers that.
const USER_FIXTURE_SOURCES = [
  path.join(__dirname, "fixtures", "auth.fixture.ts"),
  path.join(__dirname, "..", "tests", "fixtures", "fixtures.ts"),
];

function seedKey(): string {
  const hash = crypto.createHash("sha256");
  for (const file of USER_FIXTURE_SOURCES) {
    try {
      hash.update(fs.readFileSync(file));
    } catch {
      // A missing source is unexpected but must not break the run: the salt and
      // any readable sources still contribute, and the live-session check is
      // the real guard against reusing a stale state.
    }
  }
  hash.update(SESSION_CACHE_SALT);
  return hash.digest("hex").slice(0, 16);
}

function seedSidecarPath(statePath: string): string {
  return `${statePath}.seed`;
}

/**
 * A persisted session is reusable only when (1) the seed key that produced it
 * still matches and (2) the auth service still accepts its cookies. The second
 * check is the load-bearing one: sessions are long-lived, so the only realistic
 * invalidation is a database reseed, which the key alone can't detect. Skipping
 * it would trade the login tax for mystery 401s on the dependent specs.
 */
async function persistedSessionIsUsable(statePath: string): Promise<boolean> {
  if (!fs.existsSync(statePath)) return false;

  const sidecar = seedSidecarPath(statePath);
  if (!fs.existsSync(sidecar)) return false;
  if (fs.readFileSync(sidecar, "utf8").trim() !== seedKey()) return false;

  const base = await getAuthServiceBaseUrl().catch(() => null);
  if (!base) return false;

  const ctx = await request.newContext({ storageState: statePath });
  try {
    const res = await ctx.get(`${base}/auth/get-session`);
    if (!res.ok()) return false;
    // better-auth returns null (HTTP 200) for an unauthenticated request and a
    // { session, user } object when the cookie maps to a live session row.
    const body = await res.json().catch(() => null);
    return Boolean(body && body.session);
  } catch {
    return false;
  } finally {
    await ctx.dispose();
  }
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

  // The login page defaults to the OTP email form. Switch to password login.
  const passwordLink = page.getByRole("button", {
    name: "Sign in with password instead",
  });
  await passwordLink.waitFor({ state: "visible", timeout: 15000 });
  // The switch is a client onClick: a click that lands before hydration
  // attaches the handler is a silent no-op. Retry the click until the
  // password form actually appears.
  await expect(async () => {
    await passwordLink.click();
    await page.waitForSelector('input[name="username"]', { timeout: 1500 });
  }).toPass({ timeout: 15000 });
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
 * Reuse a still-valid persisted session, or log in once and persist it. The
 * two branches print distinct lines so a run's setup log makes the login tax
 * visible: "reusing cached session" means zero interactive logins occurred.
 */
async function ensureSession(
  page: import("@playwright/test").Page,
  username: string,
  password: string,
  statePath: string
) {
  if (await persistedSessionIsUsable(statePath)) {
    console.log(`[auth] reusing cached session for ${username}`);
    return;
  }
  console.log(`[auth] logging in ${username}`);
  await performLogin(page, username, password, statePath);
  fs.writeFileSync(seedSidecarPath(statePath), seedKey());
}

/**
 * Setup authentication state for Station Manager
 * Used by tests that require admin access
 */
setup("authenticate as station manager", async ({ page }) => {
  await ensureSession(
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
  await ensureSession(
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
  await ensureSession(
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
  await ensureSession(
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
  await ensureSession(
    page,
    TEST_USERS.member.username,
    TEST_USERS.member.password,
    `${authDir}/member.json`
  );
});
