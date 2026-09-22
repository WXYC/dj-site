import "@testing-library/jest-dom/vitest";
import { configure } from "@testing-library/react";

// Testing Library's own 1s ceiling for `waitFor` / `findBy*`, which is separate
// from Vitest's `testTimeout` and unaffected by it: a raised test ceiling does
// nothing for a `findBy*` that has already given up. Both have to move together
// or the suite still goes red under load, just with a different error message.
configure({ asyncUtilTimeout: 5000 });

// Mock window.matchMedia for MUI components
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});

// Mock ResizeObserver for MUI components
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Stub scrollIntoView (jsdom runs no layout engine, so it ships no
// implementation and any call throws). Components that keep a keyboard
// highlight visible inside a scrolling panel call it on every highlight move.
// Defined on the prototype so a test can `vi.spyOn(Element.prototype,
// "scrollIntoView")` to assert which element was scrolled to. Assigned
// without checking whether one already exists: a future jsdom that ships
// its own no-op (routed to the virtual console instead of throwing) would
// otherwise leave that no-op in place under a presence check that never
// fires again, and every keyboard-highlight move would flood test output.
Element.prototype.scrollIntoView = function scrollIntoView() {};

// Mock IntersectionObserver for infinite-scroll components (jsdom lacks it).
global.IntersectionObserver = class IntersectionObserver {
  readonly root = null;
  readonly rootMargin = "";
  readonly thresholds: readonly number[] = [];
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
} as unknown as typeof IntersectionObserver;

// Keep rAF/cAF answering after the jsdom environment is gone. RTK's
// autoBatchEnhancer defaults to `type: "raf"`, whose scheduler arms two timers
// per notification -- a real animation frame and a 100ms `setTimeout` fallback
// -- and whose shared callback calls a *bare* `cancelAnimationFrame`, unlike
// the request side it guards as `window.requestAnimationFrame`. Vitest deletes
// every jsdom global when a file's environment is torn down, so a fallback
// still pending inside that 100ms window fires on Node's timer queue against a
// global that no longer exists. The resulting ReferenceError belongs to no
// test, yet vitest exits non-zero on an unhandled error: the shard goes red
// with every test passing, and `Deploy Production` -- which needs `unit-tests`
// -- is skipped. Any file that dispatches an autobatched action (any RTK Query
// request) within 100ms of finishing can be the one that surfaces it.
//
// The stub has to outlive that teardown, which is why it goes on the worker
// global's prototype: teardown deletes the *own* keys jsdom contributed, and
// walks no further. Assigning to `globalThis` here instead looks equivalent and
// is not -- the assignment is deleted with everything else, and the throw comes
// back. jsdom still installs its own rAF/cAF as own properties on every file,
// so these shadowed no-ops are never what a test calls, and
// `vi.spyOn(window, "requestAnimationFrame")` still spies on the real one.
const workerGlobalPrototype = Object.getPrototypeOf(globalThis) as object;
for (const frameApi of ["requestAnimationFrame", "cancelAnimationFrame"]) {
  if (!(frameApi in workerGlobalPrototype)) {
    Object.defineProperty(workerGlobalPrototype, frameApi, {
      value: () => 0,
      writable: true,
      configurable: true,
    });
  }
}
