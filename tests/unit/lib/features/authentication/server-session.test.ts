import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

// Identity-mock react cache(): step 5 puts retry state inside the memoized
// getSessionCached, so these tests exercise it through the real cache()
// pass-through rather than relying on React 19's out-of-render behavior
// (benign today, but not guaranteed).
vi.mock("react", async () => {
  const actual = await vi.importActual("react");
  return { ...actual, cache: (fn: (...args: unknown[]) => unknown) => fn };
});

const mockCookies = vi.fn();
vi.mock("next/headers", () => ({
  cookies: () => mockCookies(),
}));

const mockGetSession = vi.fn();
vi.mock("@/lib/features/authentication/server-client", () => ({
  serverAuthClient: {
    getSession: (options: any) => mockGetSession(options),
  },
}));

import {
  getServerSession,
  getServerSessionResult,
} from "@/lib/features/authentication/server-session";
import { transportRetryConfig } from "@/lib/features/authentication/session-cache";
import { createTestBetterAuthSession } from "@/tests/helpers";

describe("getServerSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCookies.mockReturnValue({
      toString: () => "session=test-cookie",
    });
    // Avoid waiting out the real transport-retry delay in the auth-error test.
    transportRetryConfig.delayMs = 0;
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

  it("returns null for an unavailable read (a resolved 429), the same as a genuinely absent session — the compatibility guarantee existing callers rely on", async () => {
    mockGetSession.mockResolvedValue({
      data: null,
      error: { message: "Too many requests. Please try again later.", status: 429, statusText: "Too Many Requests" },
    });

    const result = await getServerSession();

    expect(result).toBeNull();
  });
});

describe("getServerSessionResult", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCookies.mockReturnValue({
      toString: () => "session=test-cookie",
    });
    transportRetryConfig.delayMs = 0;
  });

  it("returns a session kind for an authenticated read", async () => {
    const session = createTestBetterAuthSession();
    mockGetSession.mockResolvedValue({ data: session, error: null });

    const result = await getServerSessionResult();

    expect(result.kind).toBe("session");
    expect(result.kind === "session" && result.session.user.id).toBe(session.user.id);
  });

  it("returns absent for a clean data: null, and forwards the cookie header to the client", async () => {
    mockGetSession.mockResolvedValue({ data: null, error: null });

    const result = await getServerSessionResult();

    expect(result).toEqual({ kind: "absent" });
    expect(mockGetSession).toHaveBeenCalledWith({
      fetchOptions: {
        headers: { cookie: "session=test-cookie" },
      },
    });
  });

  it("returns unavailable with the status for a resolved 429", async () => {
    mockGetSession.mockResolvedValue({
      data: null,
      error: { message: "Too many requests. Please try again later.", status: 429, statusText: "Too Many Requests" },
    });

    const result = await getServerSessionResult();

    expect(result).toEqual({ kind: "unavailable", status: 429 });
  });

  it("returns unavailable with no status for a transport failure", async () => {
    mockGetSession.mockRejectedValue(new Error("auth server unreachable"));

    const result = await getServerSessionResult();

    expect(result).toEqual({ kind: "unavailable" });
  });
});
