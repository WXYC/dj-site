import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useDebouncedValue } from "./useDebouncedValue";

describe("useDebouncedValue", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns initial value immediately", () => {
    const { result } = renderHook(() => useDebouncedValue("hello", 150));
    expect(result.current).toBe("hello");
  });

  it("does not update before delay", () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebouncedValue(value, 150),
      { initialProps: { value: "hello" } }
    );

    rerender({ value: "world" });
    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(result.current).toBe("hello");
  });

  it("updates after delay", () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebouncedValue(value, 150),
      { initialProps: { value: "hello" } }
    );

    rerender({ value: "world" });
    act(() => {
      vi.advanceTimersByTime(150);
    });

    expect(result.current).toBe("world");
  });

  it("resets timer on rapid changes, only emits last value", () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebouncedValue(value, 150),
      { initialProps: { value: "a" } }
    );

    rerender({ value: "ab" });
    act(() => {
      vi.advanceTimersByTime(50);
    });

    rerender({ value: "abc" });
    act(() => {
      vi.advanceTimersByTime(50);
    });

    rerender({ value: "abcd" });
    act(() => {
      vi.advanceTimersByTime(150);
    });

    expect(result.current).toBe("abcd");
  });
});
