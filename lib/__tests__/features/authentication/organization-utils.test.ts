import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/lib/test-utils/msw/server";

// Mock server auth client
const mockListMembers = vi.fn();
vi.mock("@/lib/features/authentication/server-client", () => ({
  serverAuthClient: {
    organization: {
      listMembers: (options: any) => mockListMembers(options),
    },
  },
}));

// Mock auth client (client-side)
const mockClientListMembers = vi.fn();
const mockGetFullOrganization = vi.fn();
vi.mock("@/lib/features/authentication/client", () => ({
  authClient: {
    organization: {
      listMembers: (options: any) => mockClientListMembers(options),
      getFullOrganization: (options: any) => mockGetFullOrganization(options),
    },
  },
  authBaseURL: "https://api.wxyc.org/auth",
}));

// Mock fetch for organization slug resolution (used by server-side tests)
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

import {
  getAppOrganizationId,
  getAppOrganizationIdClient,
  getUserRoleInOrganizationClient,
  resolveOrganizationIdAdmin,
  _resetOrgCacheForTesting,
} from "@/lib/features/authentication/organization-utils";
import {
  getUserRoleInOrganization,
} from "@/lib/features/authentication/organization-utils.server";

describe("organization-utils", () => {
  const originalEnv = process.env;
  const originalConsoleWarn = console.warn;
  const originalConsoleError = console.error;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
    console.warn = vi.fn();
    console.error = vi.fn();
  });

  afterEach(() => {
    process.env = originalEnv;
    console.warn = originalConsoleWarn;
    console.error = originalConsoleError;
  });

  describe("getAppOrganizationId", () => {
    it("should return APP_ORGANIZATION from env", () => {
      process.env.APP_ORGANIZATION = "wxyc-org-123";

      const result = getAppOrganizationId();

      expect(result).toBe("wxyc-org-123");
    });

    it("should return undefined when APP_ORGANIZATION is not set", () => {
      delete process.env.APP_ORGANIZATION;

      const result = getAppOrganizationId();

      expect(result).toBeUndefined();
    });

    it("should warn in development when APP_ORGANIZATION is not set", () => {
      delete process.env.APP_ORGANIZATION;
      const originalNodeEnv = process.env.NODE_ENV;
      Object.defineProperty(process.env, 'NODE_ENV', { value: 'development', writable: true });

      getAppOrganizationId();

      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining("APP_ORGANIZATION environment variable is not set")
      );
      Object.defineProperty(process.env, 'NODE_ENV', { value: originalNodeEnv, writable: true });
    });

    it("should not warn in production when APP_ORGANIZATION is not set", () => {
      delete process.env.APP_ORGANIZATION;
      const originalNodeEnv = process.env.NODE_ENV;
      Object.defineProperty(process.env, 'NODE_ENV', { value: 'production', writable: true });

      getAppOrganizationId();

      expect(console.warn).not.toHaveBeenCalled();
      Object.defineProperty(process.env, 'NODE_ENV', { value: originalNodeEnv, writable: true });
    });
  });

  describe("getAppOrganizationIdClient", () => {
    it("should return NEXT_PUBLIC_APP_ORGANIZATION from env", () => {
      process.env.NEXT_PUBLIC_APP_ORGANIZATION = "wxyc-public-org";

      const result = getAppOrganizationIdClient();

      expect(result).toBe("wxyc-public-org");
    });

    it("should return undefined when NEXT_PUBLIC_APP_ORGANIZATION is not set", () => {
      delete process.env.NEXT_PUBLIC_APP_ORGANIZATION;

      const result = getAppOrganizationIdClient();

      expect(result).toBeUndefined();
    });
  });

  describe("resolveOrganizationIdAdmin", () => {
    let receivedSlug: string | null = null;

    beforeEach(() => {
      _resetOrgCacheForTesting();
      receivedSlug = null;
      server.use(
        http.get("https://api.wxyc.org/auth/admin/resolve-organization", ({ request }) => {
          const url = new URL(request.url);
          receivedSlug = url.searchParams.get("slug");
          return HttpResponse.json({ id: `org-for-${receivedSlug}` });
        })
      );
    });

    it("should use slugOverride when provided, ignoring env var", async () => {
      delete process.env.NEXT_PUBLIC_APP_ORGANIZATION;

      const result = await resolveOrganizationIdAdmin("wxyc");

      expect(result).toBe("org-for-wxyc");
      expect(receivedSlug).toBe("wxyc");
    });

    it("should fall back to env var when no slugOverride is provided", async () => {
      process.env.NEXT_PUBLIC_APP_ORGANIZATION = "wxyc-from-env";

      const result = await resolveOrganizationIdAdmin();

      expect(result).toBe("org-for-wxyc-from-env");
      expect(receivedSlug).toBe("wxyc-from-env");
    });

    it("should return null when neither slugOverride nor env var is available", async () => {
      delete process.env.NEXT_PUBLIC_APP_ORGANIZATION;

      const result = await resolveOrganizationIdAdmin();

      expect(result).toBeNull();
      expect(receivedSlug).toBeNull();
    });
  });

  describe("getUserRoleInOrganization", () => {
    beforeEach(() => {
      process.env.NEXT_PUBLIC_BETTER_AUTH_URL = "https://api.wxyc.org/auth";
      // Mock successful organization slug resolution
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id: "resolved-org-id" }),
      });
    });

    it("should return user role when member exists", async () => {
      mockListMembers.mockResolvedValue({
        data: {
          members: [{ userId: "user-123", role: "dj" }],
        },
        error: null,
      });

      const result = await getUserRoleInOrganization("user-123", "wxyc", "cookie");

      expect(result).toBe("dj");
    });

    it("should return undefined when user is not a member", async () => {
      mockListMembers.mockResolvedValue({
        data: {
          members: [],
        },
        error: null,
      });

      const result = await getUserRoleInOrganization("user-456", "wxyc", "cookie");

      expect(result).toBeUndefined();
    });

    it("should return undefined on API error", async () => {
      mockListMembers.mockResolvedValue({
        data: null,
        error: { message: "API Error" },
      });

      const result = await getUserRoleInOrganization("user-123", "wxyc", "cookie");

      expect(result).toBeUndefined();
      expect(console.error).toHaveBeenCalledWith(
        "Error fetching organization member role:",
        { message: "API Error" }
      );
    });

    it("should return undefined on exception", async () => {
      mockListMembers.mockRejectedValue(new Error("Network error"));

      const result = await getUserRoleInOrganization("user-123", "wxyc", "cookie");

      expect(result).toBeUndefined();
      expect(console.error).toHaveBeenCalledWith(
        "Exception fetching organization member role:",
        expect.any(Error)
      );
    });

    it("should pass cookie header to auth client", async () => {
      mockListMembers.mockResolvedValue({
        data: { members: [{ userId: "user-123", role: "dj" }] },
        error: null,
      });

      await getUserRoleInOrganization("user-123", "org-id", "my-cookie");

      expect(mockListMembers).toHaveBeenCalledWith(
        expect.objectContaining({
          fetchOptions: {
            headers: { cookie: "my-cookie" },
          },
        })
      );
    });

    it("should normalize musicDirector role variations", async () => {
      mockListMembers.mockResolvedValue({
        data: {
          members: [{ userId: "user-123", role: "music_director" }],
        },
        error: null,
      });

      const result = await getUserRoleInOrganization("user-123", "wxyc", "cookie");

      expect(result).toBe("musicDirector");
    });

    it("should normalize stationManager role variations", async () => {
      mockListMembers.mockResolvedValue({
        data: {
          members: [{ userId: "user-123", role: "station-manager" }],
        },
        error: null,
      });

      const result = await getUserRoleInOrganization("user-123", "wxyc", "cookie");

      expect(result).toBe("stationManager");
    });

    it("should return undefined when organization slug resolution fails", async () => {
      // Clear previous mock implementations
      mockListMembers.mockReset();
      mockFetch.mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ message: "Not found" }),
      });

      const result = await getUserRoleInOrganization("user-123", "invalid-slug", "cookie");

      expect(result).toBeUndefined();
    });
  });

  describe("getUserRoleInOrganizationClient", () => {
    beforeEach(() => {
      mockGetFullOrganization.mockResolvedValue({
        data: { id: "resolved-org-id" },
        error: null,
      });
    });

    it("should return user role when member exists", async () => {
      mockClientListMembers.mockResolvedValue({
        data: {
          members: [{ userId: "user-123", role: "musicDirector" }],
        },
        error: null,
      });

      const result = await getUserRoleInOrganizationClient("user-123", "wxyc");

      expect(result).toBe("musicDirector");
    });

    it("should return undefined when user is not a member", async () => {
      mockClientListMembers.mockResolvedValue({
        data: {
          members: [],
        },
        error: null,
      });

      const result = await getUserRoleInOrganizationClient("user-456", "wxyc");

      expect(result).toBeUndefined();
    });

    it("should return undefined on API error", async () => {
      mockClientListMembers.mockResolvedValue({
        data: null,
        error: { message: "API Error" },
      });

      const result = await getUserRoleInOrganizationClient("user-123", "wxyc");

      expect(result).toBeUndefined();
    });

    it("should resolve slug to ID before querying members", async () => {
      mockGetFullOrganization.mockResolvedValue({
        data: { id: "org-id-from-slug" },
        error: null,
      });
      mockClientListMembers.mockResolvedValue({
        data: { members: [{ userId: "user-123", role: "dj" }] },
        error: null,
      });

      await getUserRoleInOrganizationClient("user-123", "wxyc-slug");

      expect(mockGetFullOrganization).toHaveBeenCalledWith({
        query: { organizationSlug: "wxyc-slug" },
      });
      expect(mockClientListMembers).toHaveBeenCalledWith(
        expect.objectContaining({
          query: expect.objectContaining({
            organizationId: "org-id-from-slug",
          }),
        })
      );
    });

    it("should use slug as ID fallback when slug resolution fails", async () => {
      mockGetFullOrganization.mockResolvedValue({
        data: null,
        error: { message: "Not found" },
      });
      mockClientListMembers.mockResolvedValue({
        data: { members: [{ userId: "user-123", role: "dj" }] },
        error: null,
      });

      await getUserRoleInOrganizationClient("user-123", "org-id-123");

      expect(mockClientListMembers).toHaveBeenCalledWith(
        expect.objectContaining({
          query: expect.objectContaining({
            organizationId: "org-id-123",
          }),
        })
      );
    });

    it("should normalize role variations", async () => {
      mockClientListMembers.mockResolvedValue({
        data: {
          members: [{ userId: "user-123", role: "STATIONMANAGER" }],
        },
        error: null,
      });

      const result = await getUserRoleInOrganizationClient("user-123", "wxyc");

      expect(result).toBe("stationManager");
    });

    it("should return undefined when member has no role", async () => {
      mockClientListMembers.mockResolvedValue({
        data: {
          members: [{ userId: "user-123", role: undefined }],
        },
        error: null,
      });

      const result = await getUserRoleInOrganizationClient("user-123", "wxyc");

      expect(result).toBeUndefined();
    });
  });

});
