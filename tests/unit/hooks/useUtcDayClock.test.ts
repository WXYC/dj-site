import { describe, it, expect, vi, onTestFinished } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useUtcDayClock } from "@/src/hooks/useUtcDayClock";
import { utcDateISO } from "@/src/utilities/stationTime";

// Registered before any assertion in every case below, so a failed
// expectation still leaves the real clock restored for the next test.
function useFakeClockAt(iso: string) {
  vi.useFakeTimers({ toFake: ["Date", "setInterval", "clearInterval"] });
  onTestFinished(() => {
    vi.useRealTimers();
  });
  vi.setSystemTime(new Date(iso));
}

describe("useUtcDayClock", () => {
  it("does not commit a new value for a tick that stays inside the same UTC day", () => {
    useFakeClockAt("2026-09-12T23:58:00Z");
    const anchorMs = Date.now();
    const { result } = renderHook(() => useUtcDayClock(anchorMs));
    const before = result.current;

    act(() => {
      vi.advanceTimersByTime(60_000);
    });

    // Same Date instance, not just the same day -- the hook's setState
    // updater returns the previous value unchanged on a no-op tick, so React
    // bails out of the render entirely rather than committing an equal-but-
    // distinct Date.
    expect(result.current).toBe(before);
    expect(utcDateISO(result.current!)).toBe("2026-09-12");
  });

  it("commits a value in the new UTC day once a tick crosses midnight", () => {
    useFakeClockAt("2026-09-12T23:58:00Z");
    const anchorMs = Date.now();
    const { result } = renderHook(() => useUtcDayClock(anchorMs));

    act(() => {
      vi.advanceTimersByTime(3 * 60_000);
    });

    expect(utcDateISO(result.current!)).toBe("2026-09-13");
  });

  it("resets to a new anchor instant rather than continuing from the last tick", () => {
    useFakeClockAt("2026-09-12T23:58:00Z");
    const firstAnchor = Date.now();
    const { result, rerender } = renderHook(({ anchorMs }) => useUtcDayClock(anchorMs), {
      initialProps: { anchorMs: firstAnchor },
    });

    act(() => {
      vi.advanceTimersByTime(3 * 60_000);
    });
    expect(utcDateISO(result.current!)).toBe("2026-09-13");

    const secondAnchor = Date.parse("2026-09-01T00:00:00Z");
    rerender({ anchorMs: secondAnchor });

    expect(result.current?.getTime()).toBe(secondAnchor);
  });

  it("returns undefined when there is no anchor to read", () => {
    useFakeClockAt("2026-09-12T23:58:00Z");
    const { result } = renderHook(() => useUtcDayClock(undefined));

    expect(result.current).toBeUndefined();
  });
});
