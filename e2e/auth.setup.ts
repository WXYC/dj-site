import { test as setup, expect, request, Browser } from "@playwright/test";
import {
  TEST_USERS,
  getAuthServiceBaseUrl,
  completeOnboardingWithInviteToken,
} from "./fixtures/auth.fixture";
import { RosterPage } from "./pages/roster.page";
import { setExperienceViaAccount } from "./helpers/experience";
import { APP_SKIN_STORAGE_KEY } from "../lib/features/experiences/preferences";
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
// covers that. The classic identities (CLASSIC_MD_USER, CLASSIC_DJ_USER) are
// declared inline further down this same file, so __filename covers them too.
const USER_FIXTURE_SOURCES = [
  path.join(__dirname, "fixtures", "auth.fixture.ts"),
  path.join(__dirname, "..", "tests", "fixtures", "fixtures.ts"),
  __filename,
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

interface ClassicIdentity {
  username: string;
  password: string;
  email: string;
  realName: string;
  djName: string;
  role: "dj" | "musicDirector";
  statePath: string;
}

/**
 * Dedicated identities whose experience preference is classic, so classic
 * assertions on authenticated dashboard URLs are ordinary tests rather than a
 * race against every other spec's shared seeded users. Not in TEST_USERS:
 * they are not seeded by Backend-Service (see dev_env/setup-e2e-test-users.ts
 * for that set) — each is created here, once, via the same admin roster path
 * the admin specs exercise, and its appSkin is set through the app's own
 * experience-switch flow rather than a raw API call, so the fixture never
 * predicts an internal endpoint shape it doesn't own. Both are provisioned by
 * {@link provisionClassicIdentity}.
 *
 * The classic-librarian screens are authority-split (rotation list is
 * DJ-readable, rotation insert and catalog admin are MD-gated), so specs that
 * assert that split need identities at both authorities — hence two entries
 * rather than one.
 */
const CLASSIC_MD_USER: ClassicIdentity = {
  username: "test_classic_md",
  // Set through the onboarding form (unlike TEST_USERS, which are seeded
  // directly into the database), so it must satisfy isStrongPassword —
  // TEST_USERS' shared "testpassword123" has no uppercase and would leave
  // the onboarding form's Submit button permanently disabled.
  password: "TestClassicMd1",
  email: "test_classic_md@wxyc.org",
  realName: "Test Classic MD",
  djName: "Test Classic MD",
  role: "musicDirector",
  statePath: `${authDir}/classicMd.json`,
};

const CLASSIC_DJ_USER: ClassicIdentity = {
  username: "test_classic_dj",
  password: "TestClassicDj1",
  email: "test_classic_dj@wxyc.org",
  realName: "Test Classic DJ",
  djName: "Test Classic DJ",
  role: "dj",
  statePath: `${authDir}/classicDj.json`,
};

const LOOPBACK_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1"]);

// Every octet of a dotted-quad, so this can't accidentally accept something
// like "127.0.0.1.evil.com" (which `new URL().hostname` never produces
// anyway, but the pattern should still refuse it on its own terms).
const IPV4_LOOPBACK_PATTERN = /^127\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

/**
 * Whether `hostname` — as returned by `new URL(value).hostname` — names a
 * loopback address. Exact-match against {@link LOOPBACK_HOSTNAMES} plus two
 * loopback forms that set membership alone misses: `new URL` returns the
 * IPv6 literal bracketed (`"[::1]"`), and the entire `127.0.0.0/8` block is
 * loopback, not just `127.0.0.1` (this repo's own `docs/ci-cd.md` uses
 * `127.0.0.99`). This still rejects `localhost.evil.com` and similar —
 * deliberately no suffix/`includes` matching.
 */
function isLoopbackHostname(hostname: string): boolean {
  const unbracketed =
    hostname.startsWith("[") && hostname.endsWith("]")
      ? hostname.slice(1, -1)
      : hostname;
  if (LOOPBACK_HOSTNAMES.has(unbracketed)) return true;
  const match = IPV4_LOOPBACK_PATTERN.exec(unbracketed);
  if (!match) return false;
  return match.slice(1).every((octet) => Number(octet) <= 255);
}

/**
 * Gates every write a "provision classic-preference identity" step can make
 * against whatever `E2E_BASE_URL` (and `NEXT_PUBLIC_BETTER_AUTH_URL`) point
 * at: `ensureClassicIdentityAccountExists` creates an account through the
 * live admin roster, and `setExperienceViaAccount` flips that account's
 * `appSkin` through the live switch flow. Every other setup step only logs
 * in. Called at the top of that step's body — not just inside
 * `ensureClassicIdentityAccountExists` — because a successful login skips
 * account creation entirely and would otherwise reach the appSkin write
 * unguarded. Without this, a mistyped or inherited env var pointed at a
 * shared environment has no structural guard between it and a real account
 * there.
 */
function assertLocalWriteTarget(identity: ClassicIdentity): void {
  const targets: Array<[envVar: string, value: string | undefined]> = [
    ["E2E_BASE_URL", process.env.E2E_BASE_URL || "http://localhost:3000"],
    ["NEXT_PUBLIC_BETTER_AUTH_URL", process.env.NEXT_PUBLIC_BETTER_AUTH_URL],
  ];
  for (const [envVar, value] of targets) {
    if (!value) continue;
    let hostname: string;
    try {
      hostname = new URL(value).hostname;
    } catch {
      throw new Error(
        `Refusing to provision ${identity.username}: ${envVar}="${value}" is not a valid URL.`
      );
    }
    if (!isLoopbackHostname(hostname)) {
      throw new Error(
        `Refusing to provision ${identity.username} against a non-local target: ` +
          `${envVar}="${value}" resolves to host "${hostname}", not loopback.`
      );
    }
  }
}

/**
 * True when `identity` already has a roster row. The roster renders one page
 * of ROSTER_PAGE_SIZE=50 accounts, so a raw listing only answers "is this
 * account among the first 50 alphabetically", not "does it exist" — the suite
 * creates more than 50 non-anonymous accounts within roughly two full local
 * runs. Filtering through the roster's search input, which matches every
 * account the admin fetched, is unambiguous regardless of roster size.
 */
async function classicIdentityAccountExists(
  rosterPage: RosterPage,
  identity: ClassicIdentity
): Promise<boolean> {
  await rosterPage.searchInput.fill(identity.realName);
  return await rosterPage
    .getUserRow(identity.username)
    .waitFor({ state: "visible", timeout: 15000 })
    .then(() => true)
    .catch(() => false);
}

/**
 * Creates `identity` via the station manager's roster if it doesn't already
 * exist. Idempotent: setup runs repeatedly against a persistent local stack,
 * so a prior run's account must be reconciled with, not recreated (which
 * would surface as a duplicate-username error toast).
 */
async function ensureClassicIdentityAccountExists(
  browser: Browser,
  identity: ClassicIdentity
): Promise<void> {
  assertLocalWriteTarget(identity);

  const baseURL = process.env.E2E_BASE_URL || "http://localhost:3000";
  const context = await browser.newContext({
    baseURL,
    // Requires the "authenticate as station manager" setup test (declared
    // above in this file) to have already written stationManager.json. That
    // ordering holds only because the setup project sets fullyParallel:
    // false and Playwright runs one file's tests in declaration order —
    // nothing enforces it, and a failed station-manager step doesn't stop
    // this one. A future split across files would surface a missing file
    // here as an opaque ENOENT from browser.newContext.
    storageState: `${authDir}/stationManager.json`,
  });
  const adminPage = await context.newPage();
  try {
    const rosterPage = new RosterPage(adminPage);
    await adminPage.goto("/dashboard/admin/roster");
    await rosterPage.waitForTableLoaded();

    if (await classicIdentityAccountExists(rosterPage, identity)) {
      console.log(`[auth] ${identity.username} already provisioned, skipping creation`);
      return;
    }

    console.log(`[auth] creating ${identity.username} via admin roster`);
    await rosterPage.createAccount({
      realName: identity.realName,
      username: identity.username,
      email: identity.email,
      djName: identity.djName,
      role: identity.role,
    });
    // The row, not the toast: sonner auto-dismisses on its own timer, so a
    // slow local stack can outlast it between submit and this check. The row
    // appearing is the same reconciliation signal `classicIdentityAccountExists`
    // reads above (the search filter is still applied from that check).
    await rosterPage.expectUserInRoster(identity.username);
  } finally {
    await context.close();
  }
}

/**
 * Provisions a classic-preference identity: reconciles its roster account
 * (creating it only if absent), completes onboarding on first run, and
 * switches its appSkin to classic through the live switch flow. Shared by
 * every "provision classic-preference identity" setup test below, so a
 * second identity at a different authority costs a declaration plus one
 * `setup()` call, not a copy of this whole body.
 */
async function provisionClassicIdentity(
  page: import("@playwright/test").Page,
  browser: Browser,
  identity: ClassicIdentity
): Promise<void> {
  // Gates every write below (account creation AND the appSkin switch), not
  // just the account-creation branch — see assertLocalWriteTarget's doc.
  assertLocalWriteTarget(identity);

  // First-run path chains an admin roster creation, an invite-token
  // onboarding, and a full-page experience-switch reload — comfortably past
  // the file's 20s default on a cold local stack.
  setup.setTimeout(60_000);

  const statePath = identity.statePath;

  if (await persistedSessionIsUsable(statePath)) {
    console.log(`[auth] reusing cached session for ${identity.username}`);
    return;
  }

  let loggedIn = true;
  try {
    await performLogin(page, identity.username, identity.password, statePath);
  } catch (error) {
    console.log(`[auth] ${identity.username} not yet provisioned (${error})`);
    loggedIn = false;
  }

  if (!loggedIn) {
    console.log(`[auth] logging in ${identity.username} failed, provisioning account`);
    await ensureClassicIdentityAccountExists(browser, identity);
    await completeOnboardingWithInviteToken(page, identity.email, identity.password);
  }

  // /dashboard/help is classic-only, so the modern slot (the account's
  // fresh default) renders ExperienceGap there and offers the real switch
  // flow this identity exists to have already taken.
  await setExperienceViaAccount(page, "classic", "/dashboard/help");

  // The switch flow also sets the app_state cookie to classic (see
  // useExperienceSwitch) AND the wxyc_app_skin localStorage key (see
  // writeLocalAppSkin), so by this point the cookie, localStorage, and the
  // account field all agree and any one alone would render the classic slot.
  // useThemePreferenceSync (mounted unconditionally in the root layout) falls
  // back to localStorage whenever the cookie is absent, re-persisting the
  // cookie and reloading — so dropping only the cookie leaves localStorage as
  // a live second lever that reproduces the classic render without the
  // account's appSkin ever being consulted. Strip both from what gets
  // persisted so the specs that assert against this identity are
  // demonstrably exercising the account's appSkin field alone — if appSkin
  // ever became nullable, a persisted cookie or localStorage entry would
  // silently keep those specs passing for the wrong reason.
  await page.context().clearCookies({ name: "app_state" });
  await page.evaluate((key) => localStorage.removeItem(key), APP_SKIN_STORAGE_KEY);
  await page.context().storageState({ path: statePath });
  fs.writeFileSync(seedSidecarPath(statePath), seedKey());
}

/**
 * Setup authentication state for the classic-preference MD identity.
 * Used by classic-experience specs on authenticated dashboard URLs.
 */
setup("provision classic-preference identity (music director)", async ({ page, browser }) => {
  await provisionClassicIdentity(page, browser, CLASSIC_MD_USER);
});

/**
 * Setup authentication state for the classic-preference DJ identity. Exists
 * so classic-experience specs can assert the DJ-vs-MD authority split on the
 * upcoming classic librarian screens without racing a shared seeded user's
 * appSkin (see provisionClassicIdentity's doc).
 */
setup("provision classic-preference identity (dj)", async ({ page, browser }) => {
  await provisionClassicIdentity(page, browser, CLASSIC_DJ_USER);
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
