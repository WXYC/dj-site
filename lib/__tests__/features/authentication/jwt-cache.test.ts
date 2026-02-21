import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/lib/test-utils/msw/server";

vi.mock("better-auth/react", () => ({
  createAuthClient: () => ({
    useSession: vi.fn(() => ({ data: null, isPending: false })),
    signIn: { username: vi.fn() },
    signOut: vi.fn(),
  }),
}));

vi.mock("better-auth/client/plugins", () => ({
  adminClient: vi.fn(() => ({})),
  usernameClient: vi.fn(() => ({})),
  jwtClient: vi.fn(() => ({})),
  organizationClient: vi.fn(() => ({})),
}));

import { getJWTToken, clearTokenCache } from "@/lib/features/authentication/client";

describe("JWT token caching (Bug 4)", () => {
  let fetchCount = 0;

  beforeEach(() => {
    clearTokenCache();
    fetchCount = 0;
    server.use(
      http.get("*/token", () => {
        fetchCount++;
        return HttpResponse.json({ token: "test-jwt-token" });
      })
    );
  });

  afterEach(() => {
    clearTokenCache();
  });

  it("should fetch the token on first call", async () => {
    const token = await getJWTToken();
    expect(token).toBe("test-jwt-token");
    expect(fetchCount).toBe(1);
  });

  it("should return cached token on subsequent calls without refetching", async () => {
    await getJWTToken();
    await getJWTToken();
    await getJWTToken();
    expect(fetchCount).toBe(1);
  });

  it("should deduplicate concurrent requests", async () => {
    const [token1, token2, token3] = await Promise.all([
      getJWTToken(),
      getJWTToken(),
      getJWTToken(),
    ]);

    expect(token1).toBe("test-jwt-token");
    expect(token2).toBe("test-jwt-token");
    expect(token3).toBe("test-jwt-token");
    expect(fetchCount).toBe(1);
  });

  it("should refetch after cache is cleared", async () => {
    await getJWTToken();
    clearTokenCache();
    await getJWTToken();
    expect(fetchCount).toBe(2);
  });

  it("should not cache null tokens from failed requests", async () => {
    server.use(
      http.get("*/token", () => {
        fetchCount++;
        return new HttpResponse(null, { status: 401 });
      }, { once: true })
    );

    const token1 = await getJWTToken();
    expect(token1).toBeNull();

    server.use(
      http.get("*/token", () => {
        fetchCount++;
        return HttpResponse.json({ token: "recovered-token" });
      })
    );

    const token2 = await getJWTToken();
    expect(token2).toBe("recovered-token");
  });
});
