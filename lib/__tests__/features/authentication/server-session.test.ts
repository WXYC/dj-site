import { describe, it, expect, vi, beforeEach } from "vitest";

const mockCookies = vi.fn();
vi.mock("next/headers", () => ({
  cookies: () => mockCookies(),
}));

const mockRedirect = vi.fn();
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    mockRedirect(url);
    throw new Error(`REDIRECT:${url}`);
  },
}));

const mockGetSession = vi.fn();
vi.mock("@/lib/features/authentication/server-client", () => ({
  serverAuthClient: {
    getSession: (options: any) => mockGetSession(options),
  },
}));

import {
  getServerSession,
  requireAuth,
} from "@/lib/features/authentication/server-utils";
import { createTestBetterAuthSession } from "@/lib/test-utils";

describe("getServerSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCookies.mockReturnValue({
      toString: () => "session=test-cookie",
    });
  });

  it("should return session when authenticated", async () => {
    const session = createTestBetterAuthSession();
    mockGetSession.mockResolvedValue({ data: session, error: null });

    const result = await getServerSession();

    expect(result).not.toBeNull();
    expect(result?.user.id).toBe(session.user.id);
  });

  it("should return null when not authenticated", async () => {
    mockGetSession.mockResolvedValue({ data: null, error: null });

    const result = await getServerSession();

    expect(result).toBeNull();
  });

  it("should return null on auth error", async () => {
    mockGetSession.mockRejectedValue(new Error("Auth server error"));

    const result = await getServerSession();

    expect(result).toBeNull();
  });

  it("should pass cookies to auth client", async () => {
    const session = createTestBetterAuthSession();
    mockGetSession.mockResolvedValue({ data: session, error: null });

    await getServerSession();

    expect(mockGetSession).toHaveBeenCalledWith({
      fetchOptions: {
        headers: { cookie: "session=test-cookie" },
      },
    });
  });

  it("should normalize username from null to undefined", async () => {
    const session = {
      ...createTestBetterAuthSession(),
      user: {
        ...createTestBetterAuthSession().user,
        username: null,
      },
    };
    mockGetSession.mockResolvedValue({ data: session, error: null });

    const result = await getServerSession();

    expect(result?.user.username).toBeUndefined();
  });

  it("should preserve all user fields when normalizing session", async () => {
    const session = createTestBetterAuthSession({
      user: {
        id: "user-456",
        email: "complete@wxyc.org",
        name: "completename",
        username: "completeuser",
        emailVerified: true,
        realName: "Complete Real Name",
        djName: "Complete DJ Name",
        appSkin: "light",
        role: "musicDirector",
        createdAt: new Date("2024-01-01"),
        updatedAt: new Date("2024-06-01"),
      },
    });
    mockGetSession.mockResolvedValue({ data: session, error: null });

    const result = await getServerSession();

    expect(result?.user.id).toBe("user-456");
    expect(result?.user.email).toBe("complete@wxyc.org");
    expect(result?.user.name).toBe("completename");
    expect(result?.user.username).toBe("completeuser");
    expect(result?.user.emailVerified).toBe(true);
    expect(result?.user.realName).toBe("Complete Real Name");
    expect(result?.user.djName).toBe("Complete DJ Name");
    expect(result?.user.appSkin).toBe("light");
  });

  it("should handle session with error in response", async () => {
    mockGetSession.mockResolvedValue({
      data: null,
      error: { message: "Session expired", code: "SESSION_EXPIRED" },
    });

    const result = await getServerSession();

    expect(result).toBeNull();
  });
});

describe("requireAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCookies.mockReturnValue({
      toString: () => "session=test-cookie",
    });
  });

  it("should return session when authenticated", async () => {
    const session = createTestBetterAuthSession();
    mockGetSession.mockResolvedValue({ data: session, error: null });

    const result = await requireAuth();

    expect(result.user.id).toBe(session.user.id);
  });

  it("should redirect to /login when not authenticated", async () => {
    mockGetSession.mockResolvedValue({ data: null, error: null });

    await expect(requireAuth()).rejects.toThrow("REDIRECT:/login");
    expect(mockRedirect).toHaveBeenCalledWith("/login");
  });
});
