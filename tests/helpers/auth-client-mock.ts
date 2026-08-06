import { vi } from "vitest";

/**
 * Replacement module for `@/lib/features/authentication/client`, shaped as an
 * unauthenticated browser session.
 *
 * The real module builds a better-auth client at import time. Reading its
 * `useSession` store installs polling plus `storage`, `visibilitychange`,
 * `online` and `offline` listeners, and the matching teardown is deferred a
 * second past the last subscriber. A short test file finishes inside that
 * second, so the deferred teardown runs after jsdom's globals are gone and
 * throws `window is not defined` out of a timer, which vitest counts as an
 * unhandled error and fails the whole run even though every test passed.
 *
 * Any test that renders a component reaching `useAuthentication` (directly, or
 * through `useRegistry` / `useBin` / `usePlayNow`) must therefore replace the
 * module instead of letting it instantiate. `vi.mock` factories cannot close
 * over imports, so pull this in from inside the factory:
 *
 * ```ts
 * vi.mock("@/lib/features/authentication/client", async () => {
 *   const { createAuthClientModuleMock } = await import(
 *     "@/tests/helpers/auth-client-mock"
 *   );
 *   return createAuthClientModuleMock();
 * });
 * ```
 *
 * Import it by path, never through `@/tests/helpers`: the barrel pulls in the
 * Redux store, which imports the very module being replaced.
 */
export function createAuthClientModuleMock() {
  return {
    authBaseURL: "http://localhost:8082/auth",
    authFetch: vi.fn(async () => ({ ok: false, status: 401, data: null })),
    authClient: {
      useSession: () => ({
        data: null,
        error: null,
        isPending: false,
        isRefetching: false,
        refetch: vi.fn(),
      }),
      getSession: vi.fn(async () => ({ data: null, error: null })),
      signOut: vi.fn(async () => ({ data: null, error: null })),
    },
    getJWTToken: vi.fn(async () => null),
    clearTokenCache: vi.fn(),
    lookupEmailByIdentifier: vi.fn(async () => null),
    completeOnboarding: vi.fn(async () => {
      throw new Error("completeOnboarding is not stubbed in this test");
    }),
  };
}
