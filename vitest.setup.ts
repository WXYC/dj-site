import "@testing-library/jest-dom/vitest";
import { afterAll, afterEach, beforeAll, vi } from "vitest";
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
