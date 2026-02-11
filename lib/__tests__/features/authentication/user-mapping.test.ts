import { describe, it, expect, vi } from "vitest";
import { Authorization } from "@/lib/features/admin/types";

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

vi.mock("@/lib/features/authentication/server-client", () => ({
  serverAuthClient: {
    getSession: vi.fn(),
  },
}));

import { getUserFromSession } from "@/lib/features/authentication/server-utils";
import {
  createTestBetterAuthSession,
  createTestSessionWithRole,
} from "@/lib/test-utils";

describe("getUserFromSession", () => {
  it("should extract basic user information from session", () => {
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

    const result = getUserFromSession(session);

    expect(result.id).toBe("user-123");
    expect(result.email).toBe("dj@wxyc.org");
    expect(result.name).toBe("djuser");
    expect(result.realName).toBe("Real DJ Name");
    expect(result.djName).toBe("DJ Cool");
  });

  it("should use username when available", () => {
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

    expect(getUserFromSession(session).username).toBe("usernamevalue");
  });

  it("should fall back to name when username is not set", () => {
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

    expect(getUserFromSession(session).username).toBe("fallbackname");
  });

  it("should map station manager role to SM authority", () => {
    const session = createTestSessionWithRole("stationManager");

    expect(getUserFromSession(session).authority).toBe(Authorization.SM);
  });

  it("should map music director role to MD authority", () => {
    const session = createTestSessionWithRole("musicDirector");

    expect(getUserFromSession(session).authority).toBe(Authorization.MD);
  });

  it("should map dj role to DJ authority", () => {
    const session = createTestSessionWithRole("dj");

    expect(getUserFromSession(session).authority).toBe(Authorization.DJ);
  });

  it("should map member role to NO authority", () => {
    const session = createTestSessionWithRole("member");

    expect(getUserFromSession(session).authority).toBe(Authorization.NO);
  });

  it("should handle missing role by defaulting to NO authority", () => {
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

    expect(getUserFromSession(session).authority).toBe(Authorization.NO);
  });

  it("should convert undefined realName to undefined (not null)", () => {
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

    expect(getUserFromSession(session).realName).toBeUndefined();
  });

  it("should convert undefined djName to undefined (not null)", () => {
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

    expect(getUserFromSession(session).djName).toBeUndefined();
  });

  it("should include emailVerified status", () => {
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

    expect(getUserFromSession(sessionVerified).emailVerified).toBe(true);
    expect(getUserFromSession(sessionUnverified).emailVerified).toBe(false);
  });

  it("should include appSkin preference", () => {
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

    expect(getUserFromSession(session).appSkin).toBe("dark");
  });

  it("should include createdAt and updatedAt timestamps", () => {
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

    const result = getUserFromSession(session);

    expect(result.createdAt).toEqual(createdAt);
    expect(result.updatedAt).toEqual(updatedAt);
  });
});
