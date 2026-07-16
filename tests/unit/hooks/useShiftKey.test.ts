import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useShiftKey } from "@/src/hooks/applicationHooks";

// Focused coverage for the alt-tab reset (#635): a Shift held while the window
// loses focus never emits a keyup on window, so without a blur/visibilitychange
// reset the flag stays stuck true and silently inverts bin actions.
describe("useShiftKey", () => {
  function pressShift() {
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Shift" }));
    });
  }

  it("tracks the happy keydown/keyup path", () => {
    const { result } = renderHook(() => useShiftKey());
    expect(result.current).toBe(false);

    pressShift();
    expect(result.current).toBe(true);

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keyup", { key: "Shift" }));
    });
    expect(result.current).toBe(false);
  });

  it("resets to false on window blur while Shift is held", () => {
    const { result } = renderHook(() => useShiftKey());
    pressShift();
    expect(result.current).toBe(true);

    act(() => {
      window.dispatchEvent(new Event("blur"));
    });
    expect(result.current).toBe(false);
  });

  it("resets to false when the tab becomes hidden", () => {
    const { result } = renderHook(() => useShiftKey());
    pressShift();
    expect(result.current).toBe(true);

    const spy = Object.getOwnPropertyDescriptor(Document.prototype, "hidden");
    Object.defineProperty(document, "hidden", {
      configurable: true,
      get: () => true,
    });
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(result.current).toBe(false);

    // Restore the original descriptor so other tests see a visible document.
    if (spy) {
      Object.defineProperty(document, "hidden", spy);
    } else {
      Object.defineProperty(document, "hidden", {
        configurable: true,
        get: () => false,
      });
    }
  });

  it("does not reset on visibilitychange while the tab stays visible", () => {
    const { result } = renderHook(() => useShiftKey());
    pressShift();
    expect(result.current).toBe(true);

    // document.hidden defaults to false in jsdom.
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(result.current).toBe(true);
  });
});
