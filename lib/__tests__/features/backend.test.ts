import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock the authentication client module before importing
vi.mock("@/lib/features/authentication/client", () => ({
  getJWTToken: vi.fn(),
}));

// We need to mock fetchBaseQuery from Redux Toolkit
const mockPrepareHeaders = vi.fn();
const mockFetchBaseQuery = vi.fn((config) => {
  // Store the config so we can test it
  mockFetchBaseQuery.lastConfig = config;
  // Return a mock base query function
  return vi.fn(async () => ({ data: {} }));
});
mockFetchBaseQuery.lastConfig = null as any;

vi.mock("@reduxjs/toolkit/query", () => ({
  fetchBaseQuery: (config: any) => mockFetchBaseQuery(config),
}));

import { getJWTToken } from "@/lib/features/authentication/client";
import { backendBaseQuery } from "@/lib/features/backend";

const mockedGetJWTToken = vi.mocked(getJWTToken);

describe("backend", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = {
      ...originalEnv,
      NEXT_PUBLIC_BACKEND_URL: "https://api.example.com",
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("backendBaseQuery", () => {
    it("should create a base query with the correct baseUrl", () => {
      backendBaseQuery("catalog");

      expect(mockFetchBaseQuery).toHaveBeenCalled();
      expect(mockFetchBaseQuery.lastConfig.baseUrl).toBe(
        "https://api.example.com/catalog"
      );
    });

    it("should create a base query with different domains", () => {
      backendBaseQuery("flowsheet");

      expect(mockFetchBaseQuery.lastConfig.baseUrl).toBe(
        "https://api.example.com/flowsheet"
      );
    });

    it("should handle empty domain", () => {
      backendBaseQuery("");

      expect(mockFetchBaseQuery.lastConfig.baseUrl).toBe(
        "https://api.example.com/"
      );
    });

    describe("prepareHeaders", () => {
      it("should set Content-Type header to application/json", async () => {
        backendBaseQuery("test");

        const prepareHeaders = mockFetchBaseQuery.lastConfig.prepareHeaders;
        expect(prepareHeaders).toBeDefined();

        const mockHeaders = new Map<string, string>();
        mockHeaders.set = vi.fn();

        mockedGetJWTToken.mockResolvedValue(null);

        await prepareHeaders(mockHeaders);

        expect(mockHeaders.set).toHaveBeenCalledWith(
          "Content-Type",
          "application/json"
        );
      });

      it("should set Authorization header with Bearer token when JWT is available", async () => {
        backendBaseQuery("test");

        const prepareHeaders = mockFetchBaseQuery.lastConfig.prepareHeaders;
        const mockHeaders = new Map<string, string>();
        mockHeaders.set = vi.fn();

        mockedGetJWTToken.mockResolvedValue("test-jwt-token-12345");

        await prepareHeaders(mockHeaders);

        expect(mockHeaders.set).toHaveBeenCalledWith(
          "Content-Type",
          "application/json"
        );
        expect(mockHeaders.set).toHaveBeenCalledWith(
          "Authorization",
          "Bearer test-jwt-token-12345"
        );
      });

      it("should not set Authorization header when JWT is null", async () => {
        backendBaseQuery("test");

        const prepareHeaders = mockFetchBaseQuery.lastConfig.prepareHeaders;
        const mockHeaders = new Map<string, string>();
        const setFn = vi.fn();
        mockHeaders.set = setFn;

        mockedGetJWTToken.mockResolvedValue(null);

        await prepareHeaders(mockHeaders);

        expect(setFn).toHaveBeenCalledTimes(1);
        expect(setFn).toHaveBeenCalledWith("Content-Type", "application/json");
        expect(setFn).not.toHaveBeenCalledWith(
          "Authorization",
          expect.anything()
        );
      });

      it("should return the modified headers", async () => {
        backendBaseQuery("test");

        const prepareHeaders = mockFetchBaseQuery.lastConfig.prepareHeaders;
        const mockHeaders = new Map<string, string>();
        mockHeaders.set = vi.fn();

        mockedGetJWTToken.mockResolvedValue("token");

        const result = await prepareHeaders(mockHeaders);

        expect(result).toBe(mockHeaders);
      });

      it("should call getJWTToken to retrieve the token", async () => {
        backendBaseQuery("test");

        const prepareHeaders = mockFetchBaseQuery.lastConfig.prepareHeaders;
        const mockHeaders = new Map<string, string>();
        mockHeaders.set = vi.fn();

        mockedGetJWTToken.mockResolvedValue("my-token");

        await prepareHeaders(mockHeaders);

        expect(mockedGetJWTToken).toHaveBeenCalledTimes(1);
      });

      it("should handle getJWTToken returning empty string", async () => {
        backendBaseQuery("test");

        const prepareHeaders = mockFetchBaseQuery.lastConfig.prepareHeaders;
        const mockHeaders = new Map<string, string>();
        const setFn = vi.fn();
        mockHeaders.set = setFn;

        mockedGetJWTToken.mockResolvedValue("");

        await prepareHeaders(mockHeaders);

        // Empty string is falsy, so Authorization should not be set
        expect(setFn).toHaveBeenCalledTimes(1);
        expect(setFn).not.toHaveBeenCalledWith(
          "Authorization",
          expect.anything()
        );
      });

      it("should set Authorization header for truthy non-null token", async () => {
        backendBaseQuery("test");

        const prepareHeaders = mockFetchBaseQuery.lastConfig.prepareHeaders;
        const mockHeaders = new Map<string, string>();
        const setFn = vi.fn();
        mockHeaders.set = setFn;

        mockedGetJWTToken.mockResolvedValue("valid-token");

        await prepareHeaders(mockHeaders);

        expect(setFn).toHaveBeenCalledWith(
          "Authorization",
          "Bearer valid-token"
        );
      });
    });

    describe("different backend URLs", () => {
      it("should work with undefined NEXT_PUBLIC_BACKEND_URL", () => {
        delete process.env.NEXT_PUBLIC_BACKEND_URL;

        backendBaseQuery("api");

        expect(mockFetchBaseQuery.lastConfig.baseUrl).toBe("undefined/api");
      });

      it("should work with localhost backend URL", () => {
        process.env.NEXT_PUBLIC_BACKEND_URL = "http://localhost:3001";

        backendBaseQuery("users");

        expect(mockFetchBaseQuery.lastConfig.baseUrl).toBe(
          "http://localhost:3001/users"
        );
      });

      it("should work with trailing slash in backend URL", () => {
        process.env.NEXT_PUBLIC_BACKEND_URL = "https://api.example.com/";

        backendBaseQuery("items");

        expect(mockFetchBaseQuery.lastConfig.baseUrl).toBe(
          "https://api.example.com//items"
        );
      });
    });
  });
});
