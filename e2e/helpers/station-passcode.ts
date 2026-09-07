import { Client } from "pg";
import { requireEnv } from "./env";

/**
 * Direct Postgres access to the two hand-rolled station-signup tables
 * (`station_passcode`, `station_signup_attempt`, schema in Backend-Service
 * migration 0160) for the station-signup E2E spec's per-run passcode
 * lifecycle. Mirrors `pg-notify.ts`: connection env is exported by
 * `scripts/e2e-local.sh` and the E2E workflow, and a missing var throws
 * loudly rather than silently connecting to the wrong place.
 *
 * WHY DIRECT SQL. The admin API can rotate and revoke a passcode, but it
 * cannot (a) set a short `expires_at` — the HTTP rotate route always mints at
 * the 14-day default TTL — nor (b) delete attempt rows, since the only
 * attempt-clearing operation it exposes (`/clear-cooldown`) writes a
 * `cooldown_cleared` floor row and DELETES NOTHING by design. Both are teardown
 * requirements here (see the spec), so teardown owns them at the table.
 */
function getDbConfig() {
  const env = requireEnv("station-passcode", [
    "DB_HOST",
    "DB_PORT",
    "DB_NAME",
    "DB_USERNAME",
    "DB_PASSWORD",
  ]);
  return {
    host: env.DB_HOST,
    port: Number(env.DB_PORT),
    database: env.DB_NAME,
    user: env.DB_USERNAME,
    password: env.DB_PASSWORD,
  };
}

/**
 * Fail loudly if the station-signup spec's required env is not exported by the
 * entry point (`scripts/e2e-local.sh` or `.github/workflows/e2e-tests.yml`)
 * before Playwright runs. The three feature flags gate the surfaces the spec
 * drives — without `STATION_SIGNUP_ENABLED` the auth service does not mount
 * the public signup route (404 at signup); without
 * `NEXT_PUBLIC_STATION_SIGNUP_ENABLED` the login form never renders the "Sign
 * up here" link; and without `NEXT_PUBLIC_STATION_SIGNUP_ADMIN_ENABLED` the
 * admin roster view switcher never renders the "Signup Passcode" tab, so the
 * manager can't rotate/reveal — and the DB vars are what teardown connects
 * with. Checking presence here turns a dropped export into a named error rather
 * than a mid-spec timeout.
 */
export function requireStationSignupEnv(): void {
  requireEnv("station-signup e2e", [
    "STATION_SIGNUP_ENABLED",
    "NEXT_PUBLIC_STATION_SIGNUP_ENABLED",
    "NEXT_PUBLIC_STATION_SIGNUP_ADMIN_ENABLED",
    "DB_HOST",
    "DB_PORT",
    "DB_NAME",
    "DB_USERNAME",
    "DB_PASSWORD",
  ]);
}

async function withClient<T>(body: (client: Client) => Promise<T>): Promise<T> {
  const client = new Client(getDbConfig());
  await client.connect();
  try {
    return await body(client);
  } finally {
    await client.end();
  }
}

/**
 * Overwrite a passcode's `expires_at` to a near-term instant. Called right
 * after a fresh rotate so the run's code carries a short explicit TTL: it stays
 * live long enough for this run's signup, and self-expires soon after if a
 * crashed run never reaches teardown — the backstop against the two-active-code
 * cap that rotation enforces.
 */
export async function shortenPasscodeExpiry(passcodeId: string, expiresAt: Date): Promise<void> {
  await withClient(async (client) => {
    await client.query(`UPDATE station_passcode SET expires_at = $2 WHERE id = $1`, [
      passcodeId,
      expiresAt.toISOString(),
    ]);
  });
}

/**
 * Teardown for one fixture passcode: clear its attempt rows, then revoke it.
 *
 * Both are mandatory (see the spec's fixture doc). Revoking is not optional
 * tidiness — at most two codes may be active at once, so a teardown that only
 * cleared attempts would fail the third run against the default TTL, and
 * immediately under parallel workers or shards. The revoke is idempotent (the
 * `revoked_at IS NULL` guard), so re-running teardown after a crash is safe.
 *
 * Attempts are deleted before the revoke and scoped to this passcode's id, so
 * concurrent runs' attempt rows are left untouched.
 */
export async function revokeAndClearPasscode(passcodeId: string): Promise<void> {
  await withClient(async (client) => {
    await client.query(`DELETE FROM station_signup_attempt WHERE passcode_id = $1`, [passcodeId]);
    await client.query(
      `UPDATE station_passcode SET revoked_at = now(), revoked_reason = 'e2e_teardown' WHERE id = $1 AND revoked_at IS NULL`,
      [passcodeId]
    );
  });
}
