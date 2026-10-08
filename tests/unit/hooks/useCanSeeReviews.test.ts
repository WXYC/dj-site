import { describe, it, expect, afterEach, vi } from "vitest";
import { renderHook } from "@testing-library/react";

import { Authorization } from "@/lib/features/admin/types";
import { useAuthentication } from "@/src/hooks/authenticationHooks";
import { useCanSeeReviews } from "@/src/hooks/useCanSeeReviews";

vi.mock("@/src/hooks/authenticationHooks", () => ({ useAuthentication: vi.fn() }));

const ENV_KEY = "NEXT_PUBLIC_REVIEWS_ENABLED";

const signedIn = (authority: Authorization) => ({ data: { user: { id: "u1", authority } } });
const NO_SESSION = { data: { message: "Not Authenticated" } };

afterEach(() => {
  delete process.env[ENV_KEY];
  vi.mocked(useAuthentication).mockReset();
});

describe("useCanSeeReviews", () => {
  it.each([
    ["off", undefined, "DJ", signedIn(Authorization.DJ), false],
    ["off", undefined, "music director", signedIn(Authorization.MD), false],
    ["off", undefined, "no session", NO_SESSION, false],
    ["staff", "staff", "DJ", signedIn(Authorization.DJ), false],
    ["staff", "staff", "music director", signedIn(Authorization.MD), true],
    ["staff", "staff", "no session", NO_SESSION, false],
    ["true", "true", "DJ", signedIn(Authorization.DJ), true],
    ["true", "true", "music director", signedIn(Authorization.MD), true],
    ["true", "true", "no session", NO_SESSION, false],
  ])("flag %s, env %j, %s", (_flag, env, _who, auth, expected) => {
    if (env) process.env[ENV_KEY] = env;
    vi.mocked(useAuthentication).mockReturnValue(auth as never);
    const { result } = renderHook(() => useCanSeeReviews());
    expect(result.current).toBe(expected);
  });
});
