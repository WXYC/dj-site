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

// Moves this test's process zone off the UTC pin and proves the move took:
// assigning process.env.TZ re-derives the zone only in a forked process, so
// this holds only under vitest's default `forks` pool -- under `threads` or
// `vmThreads` the stub would be silently inert and the assertion below is
// what turns that into a failure instead of a pass. A module that built an
// `Intl.DateTimeFormat` at module scope before this call keeps the zone it
// was built in; a module under test with one must be re-imported after the
// stub (this helper does not reset modules itself -- only the caller knows
// whether the module under test holds a module-scope formatter). `zone`
// must be the canonical IANA name (e.g. "America/New_York", not the
// "US/Eastern" alias) or the assertion below fails even though the stub
// took effect, because Intl resolves aliases to their canonical form.
export function stubProcessTimeZone(zone: string): void {
  vi.stubEnv("TZ", zone);
  // Registered before the assertion below so a failed assertion still
  // restores the zone for the rest of the file, instead of leaking the
  // stub into every later test.
  onTestFinished(() => {
    vi.unstubAllEnvs();
  });
  expect(
    new Intl.DateTimeFormat().resolvedOptions().timeZone,
    "TZ stub did not take effect in this process -- rerun this file under vitest's default `forks` pool, not `--pool=threads`"
  ).toBe(zone);
}
