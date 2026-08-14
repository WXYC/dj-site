import { test as setup, expect, request, Browser } from "@playwright/test";
import {
  TEST_USERS,
  getAuthServiceBaseUrl,
  completeOnboardingWithInviteToken,
} from "./fixtures/auth.fixture";
import { RosterPage } from "./pages/roster.page";
import { setExperienceViaAccount } from "./helpers/experience";
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
 * A dedicated identity whose experience preference is classic, so classic
 * assertions on authenticated dashboard URLs are ordinary tests rather than a
 * race against every other spec's shared seeded users. Not in TEST_USERS: it
 * is not seeded by Backend-Service (see dev_env/setup-e2e-test-users.ts for
 * that set) — it is created here, once, via the same admin roster path the
 * admin specs exercise, and its appSkin is set through the app's own
 * experience-switch flow rather than a raw API call, so the fixture never
 * predicts an internal endpoint shape it doesn't own.
 */
const CLASSIC_MD_USER = {
  username: "test_classic_md",
  // Set through the onboarding form (unlike TEST_USERS, which are seeded
  // directly into the database), so it must satisfy isStrongPassword —
  // TEST_USERS' shared "testpassword123" has no uppercase and would leave
  // the onboarding form's Submit button permanently disabled.
  password: "TestClassicMd1",
  email: "test_classic_md@wxyc.org",
  realName: "Test Classic MD",
  djName: "Test Classic MD",
};

/**
 * Creates {@link CLASSIC_MD_USER} via the station manager's roster if it
 * doesn't already exist. Idempotent: setup runs repeatedly against a
 * persistent local stack, so a prior run's account must be reconciled with,
 * not recreated (which would surface as a duplicate-username error toast).
 */
async function ensureClassicMdAccountExists(browser: Browser): Promise<void> {
  const baseURL = process.env.E2E_BASE_URL || "http://localhost:3000";
  const context = await browser.newContext({
    baseURL,
    storageState: `${authDir}/stationManager.json`,
  });
  const adminPage = await context.newPage();
  try {
    const rosterPage = new RosterPage(adminPage);
    await adminPage.goto("/dashboard/admin/roster");
    await rosterPage.waitForTableLoaded();

    const alreadyExists = await rosterPage
      .getUserRow(CLASSIC_MD_USER.username)
      .isVisible()
      .catch(() => false);
    if (alreadyExists) {
      console.log(`[auth] ${CLASSIC_MD_USER.username} already provisioned, skipping creation`);
      return;
    }

    console.log(`[auth] creating ${CLASSIC_MD_USER.username} via admin roster`);
    await rosterPage.createAccount({
      realName: CLASSIC_MD_USER.realName,
      username: CLASSIC_MD_USER.username,
      email: CLASSIC_MD_USER.email,
      djName: CLASSIC_MD_USER.djName,
      role: "musicDirector",
    });
    // The row, not the toast: sonner auto-dismisses on its own timer, so a
    // slow local stack can outlast it between submit and this check. The row
    // appearing is the same reconciliation signal `alreadyExists` reads above.
    await rosterPage.expectUserInRoster(CLASSIC_MD_USER.username);
  } finally {
    await context.close();
  }
}

/**
 * Setup authentication state for the classic-preference identity.
 * Used by classic-experience specs on authenticated dashboard URLs.
 */
setup("provision classic-preference identity", async ({ page, browser }) => {
  // First-run path chains an admin roster creation, an invite-token
  // onboarding, and a full-page experience-switch reload — comfortably past
  // the file's 20s default on a cold local stack.
  setup.setTimeout(60_000);

  const statePath = `${authDir}/classicMd.json`;

  if (await persistedSessionIsUsable(statePath)) {
    console.log(`[auth] reusing cached session for ${CLASSIC_MD_USER.username}`);
    return;
  }

  let loggedIn = true;
  try {
    await performLogin(page, CLASSIC_MD_USER.username, CLASSIC_MD_USER.password, statePath);
  } catch (error) {
    console.log(`[auth] ${CLASSIC_MD_USER.username} not yet provisioned (${error})`);
    loggedIn = false;
  }

  if (!loggedIn) {
    console.log(`[auth] logging in ${CLASSIC_MD_USER.username} failed, provisioning account`);
    await ensureClassicMdAccountExists(browser);
    await completeOnboardingWithInviteToken(page, CLASSIC_MD_USER.email, CLASSIC_MD_USER.password);
  }

  // /dashboard/help is classic-only, so the modern slot (the account's
  // fresh default) renders ExperienceGap there and offers the real switch
  // flow this identity exists to have already taken.
  await setExperienceViaAccount(page, "classic", "/dashboard/help");
  await page.context().storageState({ path: statePath });
  fs.writeFileSync(seedSidecarPath(statePath), seedKey());
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
