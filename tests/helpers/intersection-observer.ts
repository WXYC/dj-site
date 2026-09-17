import { afterEach, beforeEach, vi } from "vitest";
import { act } from "@testing-library/react";

/**
 * Installs an `IntersectionObserver` stub a spec can drive.
 *
 * The DOM setup file's global stub is inert — it never hands the callback
 * back, so a spec cannot walk a pagination sentinel through it. This one
 * captures the most recently constructed observer's callback, which is the
 * one that matters: components re-create the observer whenever a gate in the
 * effect's dependencies changes.
 *
 * @returns `triggerSentinel`, which delivers one entry to that callback.
 */
export function stubIntersectionObserver(): {
  triggerSentinel: (isIntersecting?: boolean) => void;
} {
  let observedCallback: IntersectionObserverCallback | undefined;

  beforeEach(() => {
    observedCallback = undefined;
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        constructor(callback: IntersectionObserverCallback) {
          observedCallback = callback;
        }
        observe() {}
        unobserve() {}
        disconnect() {}
        takeRecords() {
          return [];
        }
      }
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  return {
    triggerSentinel: (isIntersecting = true) => {
      act(() => {
        observedCallback?.(
          [{ isIntersecting } as IntersectionObserverEntry],
          null as unknown as IntersectionObserver
        );
      });
    },
  };
}
