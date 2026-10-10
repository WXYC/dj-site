import { useEffect, useState } from "react";
import { Authorization } from "@/lib/features/admin/types";

/** The test file's hoisted object; read on every call, so a test can change it between cases. */
export interface AuthenticationHookState {
  id: string;
  authority: Authorization | number;
  /**
   * Mimics the real hook, which seeds each caller's own state from the session
   * alone (no station role yet) and switches to the resolved role after an
   * effect and a microtask: the first render answers `Authorization.NO`.
   */
  late?: boolean;
  djName?: string;
  realName?: string;
}

/**
 * Replacement module for `@/src/hooks/authenticationHooks`, signed in as
 * `state.id` with `state.authority`. `vi.mock` factories cannot close over
 * imports, so pull this in from inside the factory:
 *
 * ```ts
 * const mockAuth = vi.hoisted(() => ({ id: "dj-me", authority: 1 as number }));
 * vi.mock("@/src/hooks/authenticationHooks", async () => {
 *   const { createAuthenticationHookMock } = await import("@/tests/helpers/auth-hook-mock");
 *   return createAuthenticationHookMock(mockAuth);
 * });
 * ```
 *
 * Import it by path, never through `@/tests/helpers`: the barrel pulls in the
 * Redux store.
 */
export function createAuthenticationHookMock(state: AuthenticationHookState) {
  return {
    useAuthentication: () => {
      const [settled, setSettled] = useState(!state.late);
      useEffect(() => {
        if (settled) return;
        void Promise.resolve().then(() => setSettled(true));
      }, [settled]);
      return {
        data: {
          user: {
            id: state.id,
            authority: settled ? state.authority : Authorization.NO,
            djName: state.djName,
            realName: state.realName,
          },
        },
        authenticating: false,
        authenticated: true,
      };
    },
  };
}
