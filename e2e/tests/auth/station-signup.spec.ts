import path from "path";
import { test } from "../../fixtures/station-signup.fixture";
import { StationSignupPage } from "../../pages/station-signup.page";
import { RosterPage } from "../../pages/roster.page";
import { LoginPage } from "../../pages/login.page";
import { FlowsheetPage } from "../../pages/flowsheet.page";
import { generateEmail, generateUsername } from "../../helpers/test-data";
import { requireStationSignupEnv } from "../../helpers/station-passcode";

/**
 * Station self-signup, end to end: the one path nothing else in the suite
 * exercises whole. A station manager rotates a passcode, a brand-new DJ signs
 * up with it, the manager confirms the account is pending review and approves
 * it, and the new DJ writes the flowsheet.
 *
 * TWO PRINCIPALS, one spec. The rotate, roster, and approve phases are all
 * `stationManager`-gated and run in a context on `stationManager.json`. The
 * signup and flowsheet-write phases are the DJ the spec just created — a fresh,
 * initially unauthenticated context, NOT a pre-seeded account — so the
 * `dj.json` / `dj2.json` distinction does not apply here. The two contexts are
 * driven interleaved (rotate → sign up → review → approve → write).
 *
 * FLAGS. The public signup endpoint is mounted only when the auth service has
 * `STATION_SIGNUP_ENABLED`, its plaintext needs `STATION_PASSCODE_KEY` to mint
 * and decrypt, and the login form's "Sign up here" link needs the build-time
 * `NEXT_PUBLIC_STATION_SIGNUP_ENABLED` — all exported by `scripts/e2e-local.sh`
 * and `.github/workflows/e2e-tests.yml`. {@link requireStationSignupEnv} fails
 * fast if the two entry points forgot the flags before Playwright ran.
 *
 * PASSCODE LIFECYCLE. The `stationPasscode` fixture stamps a short explicit
 * `expires_at` on the run's freshly-rotated code and, at teardown, revokes it
 * and clears its attempt rows — so repeated runs and parallel shards never pile
 * codes up against the two-active cap rotation enforces.
 */

const authDir = path.join(__dirname, "..", "..", ".auth");
const STATION_MANAGER_STORAGE = path.join(authDir, "stationManager.json");
const BASE_URL = process.env.E2E_BASE_URL || "http://localhost:3000";

/** Satisfies the 8+ char floor the signup form and auth service both enforce. */
const NEW_DJ_PASSWORD = "E2eStationSignup1";

test.describe("Station self-signup (rotate -> signup -> review -> approve -> write)", () => {
  test.beforeAll(() => {
    // The flags gate every surface this spec drives; without them it would
    // fail mid-flow. Fail fast and named instead — see requireStationSignupEnv.
    requireStationSignupEnv();
  });

  test("a rotated passcode signs up a new DJ, who appears pending, is approved, and writes the flowsheet", async ({
    browser,
    stationPasscode,
  }) => {
    // Two principals, several page loads, and a go-live — comfortably past the
    // file's default timeout on a loaded CI runner.
    test.setTimeout(120_000);

    const username = generateUsername("signup");
    const email = generateEmail(username);
    const realName = `E2E Signup ${username}`;
    const djName = `E2E ${username}`;
    const trackArtist = `E2E Signup Artist ${username}`;
    const trackSong = "Sign-Up Test Track";

    const managerContext = await browser.newContext({
      storageState: STATION_MANAGER_STORAGE,
      baseURL: BASE_URL,
    });
    // Brand-new DJ: no stored session. It signs up, then signs in with the
    // password it just chose (station signup mints no session — the DJ logs in
    // normally afterward).
    const djContext = await browser.newContext({ storageState: undefined, baseURL: BASE_URL });

    try {
      const managerPage = await managerContext.newPage();

      // --- Phase 1: rotate a passcode (stationManager) ---
      const managerSignup = new StationSignupPage(managerPage);
      const { id: passcodeId, code } = await managerSignup.rotatePasscode();
      // Adopt it first (short explicit expires_at now, revoke + clear at
      // teardown) before asserting the reveal UI, so a failing assertion can
      // never strand an active code against the two-active cap.
      await stationPasscode.adopt(passcodeId);
      await managerSignup.expectRevealedCode(code);

      // --- Phase 2: sign up as the brand-new DJ (fresh, unauthenticated) ---
      const djPage = await djContext.newPage();
      const djSignup = new StationSignupPage(djPage);
      await djSignup.signUp({ passcode: code, username, email, password: NEW_DJ_PASSWORD, realName, djName });
      await djSignup.expectSignupSuccess(username);

      // --- Phase 3: confirm the account is pending in the roster (stationManager) ---
      const rosterPage = new RosterPage(managerPage);
      await rosterPage.goto();
      await rosterPage.waitForTableLoaded();
      await rosterPage.expectAccountPendingReview(username);

      // --- Phase 4: approve the self-signup (stationManager) ---
      await rosterPage.approveSelfSignup(username);

      // --- Phase 5: the new DJ writes the flowsheet ---
      const login = new LoginPage(djPage);
      await login.goto();
      await login.login(username, NEW_DJ_PASSWORD);
      await login.waitForRedirectToDashboard();

      const flowsheet = new FlowsheetPage(djPage);
      await flowsheet.goto();
      await flowsheet.waitForEntriesLoaded();
      try {
        await flowsheet.goLive();
        await flowsheet.addTrack({ song: trackSong, artist: trackArtist });
        await flowsheet.expectEntryWithText(trackArtist);
      } finally {
        // Leave the shared show as we found it — never end it (co-hosting is
        // the suite's shared-Backend contract; see FlowsheetPage).
        await flowsheet.ensureOffAir();
      }
    } finally {
      await djContext.close();
      await managerContext.close();
    }
  });
});
