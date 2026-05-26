import "@testing-library/jest-dom/vitest";
import { afterAll, afterEach, beforeAll, beforeEach, vi } from "vitest";
import { server } from "@/lib/test-utils/msw/server";

// Default the backend URL so that any module reading
// `process.env.NEXT_PUBLIC_BACKEND_URL` at load time (e.g., RTK Query
// `fetchBaseQuery` baseUrl construction in `lib/features/backend.ts`) sees
// a defined value during tests. Aligns with `TEST_BACKEND_URL` in
// `lib/test-utils/constants.ts`. Skip when explicitly set so a developer
// running vitest against a non-default backend isn't overridden.
if (!process.env.NEXT_PUBLIC_BACKEND_URL) {
  process.env.NEXT_PUBLIC_BACKEND_URL = "http://localhost:3001";
}

// MSW server lifecycle - use "bypass" for unhandled requests to avoid breaking tests
beforeAll(() => server.listen({ onUnhandledRequest: "bypass" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// Default catalog-track-search UI flag on in tests so chip-rendering specs pass.
// Specs that exercise the disabled state override per-test.
process.env.NEXT_PUBLIC_CATALOG_TRACK_SEARCH_UI_ENABLED = "true";

// Pin backend URL for RTK Query base queries that read process.env directly
// (matches TEST_BACKEND_URL default in test-utils/constants.ts).
process.env.NEXT_PUBLIC_BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(() => null),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  length: 0,
  key: vi.fn(() => null),
};
Object.defineProperty(window, "localStorage", { value: localStorageMock });

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

// Mock EventSource (jsdom doesn't ship one). The live-updates listener
// middleware would throw `ReferenceError: EventSource is not defined` the
// moment a test caused it to instantiate one. Test assertions should use the
// static readyState constants — `EventSource.CONNECTING` etc — not magic
// numbers, so the intent reads cleanly.
class MockEventSource implements Partial<EventSource> {
  static CONNECTING = 0 as const;
  static OPEN = 1 as const;
  static CLOSED = 2 as const;
  readyState: 0 | 1 | 2 = 0;
  url: string;
  onopen: ((this: EventSource, ev: Event) => unknown) | null = null;
  onmessage: ((this: EventSource, ev: MessageEvent) => unknown) | null = null;
  onerror: ((this: EventSource, ev: Event) => unknown) | null = null;
  constructor(url: string) {
    this.url = url;
    MockEventSource._instances.push(this);
  }
  close() {
    this.readyState = 2;
  }
  // Test helpers (not part of the EventSource spec):
  static _instances: MockEventSource[] = [];
  static _last(): MockEventSource | undefined {
    return this._instances[this._instances.length - 1];
  }
  _fireOpen() {
    this.readyState = 1;
    this.onopen?.call(this as never, new Event("open"));
  }
  _fireMessage(data: string) {
    this.onmessage?.call(
      this as never,
      new MessageEvent("message", { data })
    );
  }
  _fireError(readyState: 0 | 2) {
    this.readyState = readyState;
    this.onerror?.call(this as never, new Event("error"));
  }
}
vi.stubGlobal("EventSource", MockEventSource);
beforeEach(() => {
  MockEventSource._instances = [];
});

export { MockEventSource };
