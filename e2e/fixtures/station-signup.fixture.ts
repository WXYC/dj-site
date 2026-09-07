import { test as base } from "@playwright/test";
import { revokeAndClearPasscode, shortenPasscodeExpiry } from "../helpers/station-passcode";

/**
 * How long a fixture-adopted passcode stays live. Comfortably longer than one
 * run's rotate -> signup leg (seconds), short enough that a crashed run whose
 * teardown never fires leaves a code that self-expires well before the next
 * run — the backstop the two-active-code cap needs. Teardown revokes it long
 * before this elapses on the happy path.
 */
export const FIXTURE_PASSCODE_TTL_MS = 10 * 60 * 1000;

/**
 * Per-run station-signup passcode lifecycle.
 *
 * A test rotates a fresh passcode through the manager panel (the plaintext is
 * returned once) and hands its id to {@link StationPasscodeController.adopt},
 * which stamps the short explicit `expires_at` and registers it for teardown.
 * When the test ends — pass or fail — the fixture revokes every adopted
 * passcode and clears its attempt rows.
 *
 * The controller is test-scoped, so it is set up and torn down per test
 * invocation (each retry included): a failed attempt's passcode is revoked
 * before the next attempt rotates its own, and codes never accumulate against
 * the cap across retries, workers, or shards.
 */
export type StationPasscodeController = {
  /**
   * Adopt a freshly-rotated passcode: shorten its `expires_at` now, and revoke
   * it plus clear its attempt rows at teardown.
   */
  adopt(passcodeId: string): Promise<void>;
};

export const test = base.extend<{ stationPasscode: StationPasscodeController }>({
  stationPasscode: async ({}, use) => {
    const adopted: string[] = [];

    const controller: StationPasscodeController = {
      async adopt(passcodeId: string): Promise<void> {
        // Register for teardown BEFORE shortening: if the expiry update throws,
        // the code must still be revoked at teardown rather than leak against
        // the two-active-code cap.
        adopted.push(passcodeId);
        await shortenPasscodeExpiry(passcodeId, new Date(Date.now() + FIXTURE_PASSCODE_TTL_MS));
      },
    };

    await use(controller);

    for (const passcodeId of adopted) {
      await revokeAndClearPasscode(passcodeId);
    }
  },
});

export { expect } from "@playwright/test";
