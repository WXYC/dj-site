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
