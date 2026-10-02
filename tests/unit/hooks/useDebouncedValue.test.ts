import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useDebouncedValue } from "@/src/hooks/useDebouncedValue";

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

  describe("with a settle key", () => {
    type Props = { value: string; settleKey: number };

    function renderSettling(initial: Props) {
      return renderHook(
        ({ value, settleKey }: Props) =>
          useDebouncedValue(value, 150, settleKey),
        { initialProps: initial },
      );
    }

    it("adopts the current value at once when the key changes", () => {
      const { result, rerender } = renderSettling({ value: "a", settleKey: 0 });

      rerender({ value: "b", settleKey: 1 });

      expect(result.current).toBe("b");
    });

    it("keeps waiting while the key is unchanged", () => {
      const { result, rerender } = renderSettling({ value: "a", settleKey: 0 });

      rerender({ value: "b", settleKey: 0 });
      act(() => {
        vi.advanceTimersByTime(149);
      });

      expect(result.current).toBe("a");
    });

    it("holds the settled value against the next change until that change's own delay passes", () => {
      const { result, rerender } = renderSettling({ value: "a", settleKey: 0 });

      rerender({ value: "b", settleKey: 1 });
      rerender({ value: "c", settleKey: 1 });
      act(() => {
        vi.advanceTimersByTime(149);
      });
      expect(result.current).toBe("b");

      act(() => {
        vi.advanceTimersByTime(1);
      });
      expect(result.current).toBe("c");
    });
  });
});
