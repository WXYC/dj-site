import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";

const ENV_KEY = "NEXT_PUBLIC_REVIEW_GATE_CUTOVER_DATE";

async function load() {
  vi.resetModules();
  return import("@/lib/features/reviews/reviewGate");
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  delete process.env[ENV_KEY];
});

describe("reviewGateCutoverReached", () => {
  it("is off when the variable is unset or empty", async () => {
    const { reviewGateCutoverReached } = await load();
    vi.setSystemTime(new Date("2030-01-01T12:00:00Z"));
    expect(reviewGateCutoverReached()).toBe(false);
    process.env[ENV_KEY] = "";
    expect(reviewGateCutoverReached()).toBe(false);
  });

  // 2026-10-15 in America/New_York is EDT (UTC-4): midnight there is 04:00Z.
  it.each([
    ["2026-10-15T03:59:59Z", false],
    ["2026-10-15T04:00:00Z", true],
    ["2026-10-16T03:59:59Z", true],
    ["2026-10-14T12:00:00Z", false],
    ["2026-12-01T12:00:00Z", true],
  ])("at %s the date 2026-10-15 reads %s in station time", async (instant, expected) => {
    process.env[ENV_KEY] = "2026-10-15";
    const { reviewGateCutoverReached } = await load();
    vi.setSystemTime(new Date(instant));
    expect(reviewGateCutoverReached()).toBe(expected);
  });

  it("switches at midnight in EST as well as EDT", async () => {
    process.env[ENV_KEY] = "2026-12-15";
    const { reviewGateCutoverReached } = await load();
    vi.setSystemTime(new Date("2026-12-15T04:59:59Z"));
    expect(reviewGateCutoverReached()).toBe(false);
    vi.setSystemTime(new Date("2026-12-15T05:00:00Z"));
    expect(reviewGateCutoverReached()).toBe(true);
  });

  // The clocks change at 02:00 station time, after midnight, so the cutover
  // instant on a change day is still midnight in that day's own offset.
  it.each([
    ["2026-11-01", "2026-11-01T03:59:59Z", false],
    ["2026-11-01", "2026-11-01T04:00:00Z", true],
    ["2026-11-02", "2026-11-02T04:59:59Z", false],
    ["2026-11-02", "2026-11-02T05:00:00Z", true],
    ["2027-03-14", "2027-03-14T04:59:59Z", false],
    ["2027-03-14", "2027-03-14T05:00:00Z", true],
    ["2027-03-15", "2027-03-15T03:59:59Z", false],
    ["2027-03-15", "2027-03-15T04:00:00Z", true],
  ])("on the DST-change cutover %s, at %s it reads %s", async (date, instant, expected) => {
    process.env[ENV_KEY] = date;
    const { reviewGateCutoverReached } = await load();
    vi.setSystemTime(new Date(instant));
    expect(reviewGateCutoverReached()).toBe(expected);
  });

  it.each(["tomorrow", "2026-13-01", "2026-02-30", "2026-1-5", "10/15/2026", " 2026-10-15"])(
    "treats the malformed value %j as on and reports it once",
    async (value) => {
      process.env[ENV_KEY] = value;
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const { reviewGateCutoverReached } = await load();
      vi.setSystemTime(new Date("2020-01-01T12:00:00Z"));
      expect(reviewGateCutoverReached()).toBe(true);
      expect(reviewGateCutoverReached()).toBe(true);
      expect(errorSpy).toHaveBeenCalledTimes(1);
    },
  );
});
