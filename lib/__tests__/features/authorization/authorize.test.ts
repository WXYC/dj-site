import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { Authorization } from "@/lib/features/admin/types";

// Mock the server auth client
vi.mock("@/lib/features/authentication/server-client", () => ({
  serverAuthClient: {
    getSession: vi.fn(),
  },
}));

// Import after mocking
import { authorize, type AuthorizeSuccess, type AuthorizeFailure } from "@/lib/features/authorization/authorize";
import { serverAuthClient } from "@/lib/features/authentication/server-client";

const mockGetSession = serverAuthClient.getSession as ReturnType<typeof vi.fn>;

function createMockRequest(cookies: Record<string, string> = {}): NextRequest {
  const cookieHeader = Object.entries(cookies)
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
  
  return {
    headers: new Headers({
      cookie: cookieHeader,
    }),
  } as unknown as NextRequest;
}

describe("authorize", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("when user is not authenticated", () => {
    it("should return unauthorized response", async () => {
      mockGetSession.mockResolvedValue({ data: null, error: null });
      
      const request = createMockRequest({ "better-auth.session_token": "token" });
      const result = await authorize(request, { role: Authorization.DJ });
      
      expect(result.ok).toBe(false);
      const failure = result as AuthorizeFailure;
      expect(failure.response.status).toBe(401);
    });
  });

  describe("when user has insufficient role", () => {
    it("should return forbidden response for DJ trying to access SM route", async () => {
      mockGetSession.mockResolvedValue({
        data: {
          user: {
            id: "user-123",
            email: "dj@wxyc.org",
            name: "Test DJ",
            username: "testdj",
            role: "dj",
            emailVerified: true,
          },
          session: { id: "sess-123", userId: "user-123", expiresAt: new Date() },
        },
        error: null,
      });
      
      const request = createMockRequest({ "better-auth.session_token": "token" });
      const result = await authorize(request, { role: Authorization.SM });
      
      expect(result.ok).toBe(false);
      const failure = result as AuthorizeFailure;
      expect(failure.response.status).toBe(403);
    });
  });

  describe("when user has sufficient role", () => {
    it("should return success with branded session for exact role match", async () => {
      mockGetSession.mockResolvedValue({
        data: {
          user: {
            id: "user-123",
            email: "sm@wxyc.org",
            name: "Station Manager",
            username: "stationmgr",
            role: "stationManager",
            emailVerified: true,
          },
          session: { id: "sess-123", userId: "user-123", expiresAt: new Date() },
        },
        error: null,
      });
      
      const request = createMockRequest({ "better-auth.session_token": "token" });
      const result = await authorize(request, { role: Authorization.SM });
      
      expect(result.ok).toBe(true);
      const success = result as AuthorizeSuccess<Authorization.SM>;
      expect(success.session.user.id).toBe("user-123");
      expect(success.session.user.authority).toBe(Authorization.SM);
    });

    it("should return success when user has higher role than required", async () => {
      mockGetSession.mockResolvedValue({
        data: {
          user: {
            id: "admin-123",
            email: "admin@wxyc.org",
            name: "Admin",
            username: "admin",
            role: "admin",
            emailVerified: true,
          },
          session: { id: "sess-123", userId: "admin-123", expiresAt: new Date() },
        },
        error: null,
      });
      
      const request = createMockRequest({ "better-auth.session_token": "token" });
      const result = await authorize(request, { role: Authorization.DJ });
      
      expect(result.ok).toBe(true);
      const success = result as AuthorizeSuccess<Authorization.DJ>;
      expect(success.session.user.authority).toBe(Authorization.ADMIN);
    });
  });

  describe("role hierarchy", () => {
    const testCases = [
      { userRole: "admin", requiredRole: Authorization.ADMIN, expectSuccess: true },
      { userRole: "admin", requiredRole: Authorization.SM, expectSuccess: true },
      { userRole: "admin", requiredRole: Authorization.MD, expectSuccess: true },
      { userRole: "admin", requiredRole: Authorization.DJ, expectSuccess: true },
      { userRole: "stationManager", requiredRole: Authorization.ADMIN, expectSuccess: false },
      { userRole: "stationManager", requiredRole: Authorization.SM, expectSuccess: true },
      { userRole: "stationManager", requiredRole: Authorization.MD, expectSuccess: true },
      { userRole: "musicDirector", requiredRole: Authorization.SM, expectSuccess: false },
      { userRole: "musicDirector", requiredRole: Authorization.MD, expectSuccess: true },
      { userRole: "dj", requiredRole: Authorization.MD, expectSuccess: false },
      { userRole: "dj", requiredRole: Authorization.DJ, expectSuccess: true },
      { userRole: "member", requiredRole: Authorization.DJ, expectSuccess: false },
    ];

    testCases.forEach(({ userRole, requiredRole, expectSuccess }) => {
      it(`${userRole} ${expectSuccess ? "CAN" : "CANNOT"} access ${Authorization[requiredRole]} routes`, async () => {
        mockGetSession.mockResolvedValue({
          data: {
            user: {
              id: "user-123",
              email: "test@wxyc.org",
              name: "Test User",
              username: "testuser",
              role: userRole,
              emailVerified: true,
            },
            session: { id: "sess-123", userId: "user-123", expiresAt: new Date() },
          },
          error: null,
        });
        
        const request = createMockRequest({ "better-auth.session_token": "token" });
        const result = await authorize(request, { role: requiredRole });
        
        expect(result.ok).toBe(expectSuccess);
      });
    });
  });
});
