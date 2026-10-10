import { describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { Authorization } from "@/lib/features/admin/types";
import { createAuthenticationHookMock } from "@/tests/helpers/auth-hook-mock";

describe("createAuthenticationHookMock", () => {
  it("answers the authority on the first render when settled", () => {
    const { useAuthentication } = createAuthenticationHookMock({ id: "md-me", authority: Authorization.MD });

    const { result } = renderHook(() => useAuthentication());

    expect(result.current.data.user).toMatchObject({ id: "md-me", authority: Authorization.MD });
    expect(result.current).toMatchObject({ authenticating: false, authenticated: true });
  });

  it("answers no authority on the first render and the authority after the microtask when late", async () => {
    const { useAuthentication } = createAuthenticationHookMock({ id: "md-me", authority: Authorization.MD, late: true });
    const seen: number[] = [];

    const { result } = renderHook(() => {
      const auth = useAuthentication();
      seen.push(auth.data.user.authority);
      return auth;
    });

    expect(seen[0]).toBe(Authorization.NO);
    await act(async () => {});
    expect(result.current.data.user.authority).toBe(Authorization.MD);
  });

  it("reads the hoisted state again on each render", () => {
    const state = { id: "dj-me", authority: Authorization.DJ as number };
    const { useAuthentication } = createAuthenticationHookMock(state);

    const { result, rerender } = renderHook(() => useAuthentication());
    expect(result.current.data.user.authority).toBe(Authorization.DJ);

    state.authority = Authorization.MD;
    rerender();

    expect(result.current.data.user.authority).toBe(Authorization.MD);
  });

  it("carries the DJ and real names when given", () => {
    const { useAuthentication } = createAuthenticationHookMock({
      id: "dj-me",
      authority: Authorization.DJ,
      djName: "DJ Me",
      realName: "Juana Molina",
    });

    const { result } = renderHook(() => useAuthentication());

    expect(result.current.data.user).toMatchObject({ djName: "DJ Me", realName: "Juana Molina" });
  });
});
