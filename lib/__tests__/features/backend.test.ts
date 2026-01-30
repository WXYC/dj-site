import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock authentication client
const mockGetJWTToken = vi.fn();
vi.mock("@/lib/features/authentication/client", () => ({
  getJWTToken: () => mockGetJWTToken(),
}));

// Mock fetchBaseQuery
const mockPrepareHeaders = vi.fn();
vi.mock("@reduxjs/toolkit/query", () => ({
  fetchBaseQuery: vi.fn((config) => {
    mockPrepareHeaders.mockImplementation(config.prepareHeaders);
    return { baseUrl: config.baseUrl };
  }),
}));

describe("backendBaseQuery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_BACKEND_URL = "https://api.example.com";
  });

  it("should create base query with correct baseUrl", async () => {
    const { backendBaseQuery } = await import("@/lib/features/backend");
    const result = backendBaseQuery("test-domain");

    expect(result).toEqual({
      baseUrl: "https://api.example.com/test-domain",
    });
  });

  it("should set Content-Type header", async () => {
    const { backendBaseQuery } = await import("@/lib/features/backend");
    backendBaseQuery("domain");

    const headers = new Headers();
    await mockPrepareHeaders(headers);

    expect(headers.get("Content-Type")).toBe("application/json");
  });

  it("should set Authorization header when token exists", async () => {
    mockGetJWTToken.mockResolvedValue("test-jwt-token");

    const { backendBaseQuery } = await import("@/lib/features/backend");
    backendBaseQuery("domain");

    const headers = new Headers();
    await mockPrepareHeaders(headers);

    expect(headers.get("Authorization")).toBe("Bearer test-jwt-token");
  });

  it("should not set Authorization header when token is null", async () => {
    mockGetJWTToken.mockResolvedValue(null);

    const { backendBaseQuery } = await import("@/lib/features/backend");
    backendBaseQuery("domain");

    const headers = new Headers();
    await mockPrepareHeaders(headers);

    expect(headers.get("Authorization")).toBeNull();
  });

  it("should build URL with different domains", async () => {
    const { backendBaseQuery } = await import("@/lib/features/backend");

    const catalogQuery = backendBaseQuery("catalog");
    expect(catalogQuery.baseUrl).toBe("https://api.example.com/catalog");

    const flowsheetQuery = backendBaseQuery("flowsheet");
    expect(flowsheetQuery.baseUrl).toBe("https://api.example.com/flowsheet");
  });
});
