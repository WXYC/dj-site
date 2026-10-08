/**
 * Replacement module for `next/navigation`, for client components that only
 * call `useRouter`. `vi.mock` factories cannot close over imports, so pull
 * this in from inside the factory and hand it the router the spec asserts on:
 *
 * ```ts
 * const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
 * vi.mock("next/navigation", async () => {
 *   const { createNavigationModuleMock } = await import("@/tests/helpers/navigation-mock");
 *   return createNavigationModuleMock(router);
 * });
 * ```
 *
 * Import it by path, never through `@/tests/helpers`.
 */
export function createNavigationModuleMock<Router extends object>(router: Router) {
  return { useRouter: () => router };
}
