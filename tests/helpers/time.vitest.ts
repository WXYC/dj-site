import { vi, expect, onTestFinished } from "vitest";
import { TEST_TIMESTAMPS } from "./time";

export * from "./time";

// Mock the current time for tests
export function mockCurrentTime(date: Date = TEST_TIMESTAMPS.NOW): void {
  vi.useFakeTimers();
  vi.setSystemTime(date);
}

// Restore real timers
export function restoreRealTime(): void {
  vi.useRealTimers();
}

/**
 * Moves the process zone off the UTC pin for the rest of the current test,
 * proves the move took, and puts `TZ` back to the value it had before the
 * call once the test finishes. Only `TZ` is restored: any `vi.stubEnv` the
 * caller made itself is left alone, and the caller writes no `afterEach`.
 *
 * - Call it from a test body or a `beforeEach`. Where no test is running
 *   (`beforeAll`, describe scope, module scope) it throws before it changes
 *   anything, because the restore has no test to attach to. The zone is
 *   process-wide, so never call it from a `concurrent` test.
 * - It holds only under vitest's default `forks` pool. Assigning
 *   `process.env.TZ` re-derives the zone only in a forked process; under
 *   `threads` or `vmThreads` the assignment is silently inert, and the guard
 *   here is what turns that into a failure instead of a pass in the host
 *   zone.
 * - `zone` must be the name this runtime itself reports for the zone, i.e.
 *   what `Intl.DateTimeFormat().resolvedOptions().timeZone` returns once
 *   `TZ` is set. That is not always the name IANA lists as canonical:
 *   "US/Eastern" is reported as "America/New_York", and "Asia/Kolkata" may be
 *   reported as "Asia/Calcutta". Any other name fails the guard, loudly, even
 *   though the zone did move.
 * - A module that built an `Intl.DateTimeFormat` at module scope before the
 *   call keeps the zone it was built in, so a module under test that has one
 *   must be re-imported after the call (`vi.resetModules()` plus a dynamic
 *   import). The helper does not reset modules itself: only the caller knows
 *   whether the module under test holds such a formatter.
 */
export function stubProcessTimeZone(zone: string): void {
  const previousTZ = process.env.TZ;
  const previousZone = new Intl.DateTimeFormat().resolvedOptions().timeZone;
  // Registered before TZ changes, for two reasons: with no test running
  // this throws, and it has to throw while there is still nothing to
  // restore; and a failed guard below must still restore the zone rather
  // than leak it into every later test in the file. Vitest has no
  // single-variable unstub, and `vi.unstubAllEnvs()` would also undo the
  // caller's own stubs, so the restore stubs TZ back to its earlier value
  // (or deletes it): the same assignment, so Node re-derives the zone.
  onTestFinished(() => {
    vi.stubEnv("TZ", previousTZ);
  });
  vi.stubEnv("TZ", zone);
  const resolvedZone = new Intl.DateTimeFormat().resolvedOptions().timeZone;
  expect(
    resolvedZone,
    resolvedZone === previousZone
      ? `TZ stub did not take effect in this process (the zone is still "${previousZone}") -- rerun this file under vitest's default \`forks\` pool, not \`--pool=threads\``
      : `TZ stub took effect, but this runtime reports TZ="${zone}" as "${resolvedZone}" -- pass the name the runtime reports`
  ).toBe(zone);
}
