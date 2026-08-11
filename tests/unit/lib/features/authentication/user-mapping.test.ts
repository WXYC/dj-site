import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
import { Authorization } from "@/lib/features/admin/types";

const mockCookies = vi.fn();
vi.mock("next/headers", () => ({
  cookies: () => mockCookies(),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

vi.mock("@/lib/features/authentication/server-client", () => ({
  serverAuthClient: {
    getSession: vi.fn(),
  },
}));

const mockGetUserRoleInOrganization = vi.fn();
vi.mock("@/lib/features/authentication/organization-utils.server", () => ({
  getAppOrganizationId: vi.fn().mockReturnValue(undefined),
  getUserRoleInOrganization: (userId: string, orgId: string | undefined, cookie?: string) =>
    mockGetUserRoleInOrganization(userId, orgId, cookie),
}));

import { getUserFromSession } from "@/lib/features/authentication/server-utils";
import { createTestBetterAuthSession } from "@/tests/helpers";
import type { BetterAuthSession } from "@/lib/features/authentication/utilities";
import type { WXYCRole } from "@/lib/features/authentication/types";

/**
 * A realistic session (role null — better-auth's admin-plugin column, never
 * a WXYC tier) paired with a mocked JWT-first role resolution, standing in
 * for what a decoded JWT claim carries in production.
 */
function sessionWithResolvedRole(role: WXYCRole): BetterAuthSession {
  mockGetUserRoleInOrganization.mockResolvedValue(role);
  return createTestBetterAuthSession({
    user: {
      id: "test-user-id-123",
      email: "testdj@wxyc.org",
      name: "testdj",
      emailVerified: true,
      realName: "Test User",
      djName: "DJ Test",
      role: null,
    },
  });
}

describe("getUserFromSession", () => {
  beforeEach(() => {
    mockCookies.mockReturnValue({
      toString: () => "session=test-cookie",
    });
    mockGetUserRoleInOrganization.mockReset();
  });

  it("should extract basic user information from session", async () => {
    const session = createTestBetterAuthSession({
      user: {
        id: "user-123",
        email: "dj@wxyc.org",
        name: "djuser",
        username: "djuser",
        emailVerified: true,
        realName: "Real DJ Name",
        djName: "DJ Cool",
        role: "dj",
      },
    });

    const result = await getUserFromSession(session);

    expect(result.id).toBe("user-123");
    expect(result.email).toBe("dj@wxyc.org");
    expect(result.name).toBe("djuser");
    expect(result.realName).toBe("Real DJ Name");
    expect(result.djName).toBe("DJ Cool");
  });

  it("should use username when available", async () => {
    const session = createTestBetterAuthSession({
      user: {
        id: "test-id",
        email: "test@wxyc.org",
        name: "namevalue",
        username: "usernamevalue",
        emailVerified: true,
        realName: "Test User",
        djName: "DJ Test",
      },
    });

    expect((await getUserFromSession(session)).username).toBe("usernamevalue");
  });

  it("should fall back to name when username is not set", async () => {
    const session = createTestBetterAuthSession({
      user: {
        id: "test-id",
        email: "test@wxyc.org",
        name: "fallbackname",
        username: undefined,
        emailVerified: true,
        realName: "Test User",
        djName: "DJ Test",
      },
    });

    expect((await getUserFromSession(session)).username).toBe("fallbackname");
  });

  it("should map station manager role to SM authority", async () => {
    const session = sessionWithResolvedRole("stationManager");

    expect((await getUserFromSession(session)).authority).toBe(Authorization.SM);
  });

  it("should map music director role to MD authority with APP_ORGANIZATION unset", async () => {
    const session = sessionWithResolvedRole("musicDirector");

    expect((await getUserFromSession(session)).authority).toBe(Authorization.MD);
  });

  it("should map dj role to DJ authority", async () => {
    const session = sessionWithResolvedRole("dj");

    expect((await getUserFromSession(session)).authority).toBe(Authorization.DJ);
  });

  it("should map member role to NO authority", async () => {
    const session = sessionWithResolvedRole("member");

    expect((await getUserFromSession(session)).authority).toBe(Authorization.NO);
  });

  it("should handle missing role by defaulting to NO authority", async () => {
    const session = createTestBetterAuthSession({
      user: {
        id: "test-id",
        email: "test@wxyc.org",
        name: "testuser",
        emailVerified: true,
        realName: "Test User",
        djName: "DJ Test",
        role: undefined,
      },
    });

    expect((await getUserFromSession(session)).authority).toBe(Authorization.NO);
  });

  it("should convert undefined realName to undefined (not null)", async () => {
    const session = createTestBetterAuthSession({
      user: {
        id: "test-id",
        email: "test@wxyc.org",
        name: "testuser",
        emailVerified: true,
        realName: undefined,
        djName: "DJ Test",
      },
    });

    expect((await getUserFromSession(session)).realName).toBeUndefined();
  });

  it("should convert undefined djName to undefined (not null)", async () => {
    const session = createTestBetterAuthSession({
      user: {
        id: "test-id",
        email: "test@wxyc.org",
        name: "testuser",
        emailVerified: true,
        realName: "Test User",
        djName: undefined,
      },
    });

    expect((await getUserFromSession(session)).djName).toBeUndefined();
  });

  it("should include emailVerified status", async () => {
    const sessionVerified = createTestBetterAuthSession({
      user: {
        id: "test-id",
        email: "test@wxyc.org",
        name: "testuser",
        emailVerified: true,
        realName: "Test User",
        djName: "DJ Test",
      },
    });

    const sessionUnverified = createTestBetterAuthSession({
      user: {
        id: "test-id",
        email: "test@wxyc.org",
        name: "testuser",
        emailVerified: false,
        realName: "Test User",
        djName: "DJ Test",
      },
    });

    expect((await getUserFromSession(sessionVerified)).emailVerified).toBe(true);
    expect((await getUserFromSession(sessionUnverified)).emailVerified).toBe(false);
  });

  it("should include appSkin preference", async () => {
    const session = createTestBetterAuthSession({
      user: {
        id: "test-id",
        email: "test@wxyc.org",
        name: "testuser",
        emailVerified: true,
        realName: "Test User",
        djName: "DJ Test",
        appSkin: "dark",
      },
    });

    expect((await getUserFromSession(session)).appSkin).toBe("dark");
  });

  it("should include createdAt and updatedAt timestamps", async () => {
    const createdAt = new Date("2024-01-15");
    const updatedAt = new Date("2024-06-20");
    const session = createTestBetterAuthSession({
      user: {
        id: "test-id",
        email: "test@wxyc.org",
        name: "testuser",
        emailVerified: true,
        realName: "Test User",
        djName: "DJ Test",
        createdAt,
        updatedAt,
      },
    });

    const result = await getUserFromSession(session);

    expect(result.createdAt).toEqual(createdAt);
    expect(result.updatedAt).toEqual(updatedAt);
  });
});
