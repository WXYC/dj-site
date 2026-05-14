import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock the authentication client module before importing
vi.mock("@/lib/features/authentication/client", () => ({
  getJWTToken: vi.fn(),
}));

// PostHog is invoked by the non-JSON branch — mock it so tests don't depend on the
// browser SDK booting in jsdom. `vi.hoisted` ensures the mock fn exists when the
// (hoisted) `vi.mock` factory runs.
const { mockCaptureException } = vi.hoisted(() => ({
  mockCaptureException: vi.fn(),
}));
vi.mock("@/lib/posthog", () => ({
  posthog: { captureException: mockCaptureException },
}));

// We need to mock fetchBaseQuery from Redux Toolkit. The mock returns a function
// whose behaviour individual tests can override via `mockInnerBaseQuery`.
const { mockInnerBaseQuery, mockFetchBaseQuery } = vi.hoisted(() => {
  // Type as `any` for ergonomic per-test overrides — the wrapped query's real
  // signature is checked in `backend.ts` itself.
  const inner = vi.fn<(...args: any[]) => Promise<any>>(async () => ({ data: {} }));
  const factory = vi.fn((config: any) => {
    (factory as any).lastConfig = config;
    return inner;
  });
  (factory as any).lastConfig = null;
  return { mockInnerBaseQuery: inner, mockFetchBaseQuery: factory };
});

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
      expect((mockFetchBaseQuery as any).lastConfig.baseUrl).toBe(
        "https://api.example.com/catalog"
      );
    });

    it("should create a base query with different domains", () => {
      backendBaseQuery("flowsheet");

      expect((mockFetchBaseQuery as any).lastConfig.baseUrl).toBe(
        "https://api.example.com/flowsheet"
      );
    });

    it("should handle empty domain", () => {
      backendBaseQuery("");

      expect((mockFetchBaseQuery as any).lastConfig.baseUrl).toBe(
        "https://api.example.com/"
      );
    });

    describe("prepareHeaders", () => {
      it("should set Content-Type header to application/json", async () => {
        backendBaseQuery("test");

        const prepareHeaders = (mockFetchBaseQuery as any).lastConfig.prepareHeaders;
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

        const prepareHeaders = (mockFetchBaseQuery as any).lastConfig.prepareHeaders;
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

        const prepareHeaders = (mockFetchBaseQuery as any).lastConfig.prepareHeaders;
        const mockHeaders = new Map<string, string>();
        const setFn = vi.fn();
        mockHeaders.set = setFn;

        mockedGetJWTToken.mockResolvedValue(null);

        await prepareHeaders(mockHeaders);

        expect(setFn).toHaveBeenCalledTimes(2);
        expect(setFn).toHaveBeenCalledWith("Content-Type", "application/json");
        expect(setFn).toHaveBeenCalledWith("X-Request-Id", expect.any(String));
        expect(setFn).not.toHaveBeenCalledWith(
          "Authorization",
          expect.anything()
        );
      });

      it("should return the modified headers", async () => {
        backendBaseQuery("test");

        const prepareHeaders = (mockFetchBaseQuery as any).lastConfig.prepareHeaders;
        const mockHeaders = new Map<string, string>();
        mockHeaders.set = vi.fn();

        mockedGetJWTToken.mockResolvedValue("token");

        const result = await prepareHeaders(mockHeaders);

        expect(result).toBe(mockHeaders);
      });

      it("should call getJWTToken to retrieve the token", async () => {
        backendBaseQuery("test");

        const prepareHeaders = (mockFetchBaseQuery as any).lastConfig.prepareHeaders;
        const mockHeaders = new Map<string, string>();
        mockHeaders.set = vi.fn();

        mockedGetJWTToken.mockResolvedValue("my-token");

        await prepareHeaders(mockHeaders);

        expect(mockedGetJWTToken).toHaveBeenCalledTimes(1);
      });

      it("should handle getJWTToken returning empty string", async () => {
        backendBaseQuery("test");

        const prepareHeaders = (mockFetchBaseQuery as any).lastConfig.prepareHeaders;
        const mockHeaders = new Map<string, string>();
        const setFn = vi.fn();
        mockHeaders.set = setFn;

        mockedGetJWTToken.mockResolvedValue("");

        await prepareHeaders(mockHeaders);

        // Empty string is falsy, so Authorization should not be set
        expect(setFn).toHaveBeenCalledTimes(2);
        expect(setFn).toHaveBeenCalledWith("Content-Type", "application/json");
        expect(setFn).toHaveBeenCalledWith("X-Request-Id", expect.any(String));
        expect(setFn).not.toHaveBeenCalledWith(
          "Authorization",
          expect.anything()
        );
      });

      it("should set Authorization header for truthy non-null token", async () => {
        backendBaseQuery("test");

        const prepareHeaders = (mockFetchBaseQuery as any).lastConfig.prepareHeaders;
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

        expect((mockFetchBaseQuery as any).lastConfig.baseUrl).toBe("undefined/api");
      });

      it("should work with localhost backend URL", () => {
        process.env.NEXT_PUBLIC_BACKEND_URL = "http://localhost:3001";

        backendBaseQuery("users");

        expect((mockFetchBaseQuery as any).lastConfig.baseUrl).toBe(
          "http://localhost:3001/users"
        );
      });

      it("should work with trailing slash in backend URL", () => {
        process.env.NEXT_PUBLIC_BACKEND_URL = "https://api.example.com/";

        backendBaseQuery("items");

        expect((mockFetchBaseQuery as any).lastConfig.baseUrl).toBe(
          "https://api.example.com//items"
        );
      });
    });

    describe("non-JSON response handling (#519)", () => {
      const fakeApi = {} as any;
      const fakeExtra = {} as any;
      let warnSpy: ReturnType<typeof vi.spyOn>;

      beforeEach(() => {
        mockInnerBaseQuery.mockReset();
        mockCaptureException.mockReset();
        warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      });

      afterEach(() => {
        warnSpy.mockRestore();
      });

      it("returns { data: undefined } when the backend returns HTML 404", async () => {
        // Simulate what fetchBaseQuery emits when responseHandler='json' chokes
        // on `<!DOCTYPE html>…` from Express's default 404.
        mockInnerBaseQuery.mockResolvedValueOnce({
          error: {
            status: "PARSING_ERROR",
            originalStatus: 404,
            data: "<!DOCTYPE html><html><body>Not Found</body></html>",
            error: "SyntaxError: JSON Parse error: Unrecognized token '<'",
          },
          meta: { request: {} as Request, response: {} as Response },
        });

        const baseQuery = backendBaseQuery("library/rotation");
        const result = await baseQuery(
          { url: "/42/tracks" },
          fakeApi,
          fakeExtra
        );

        expect(result).toEqual(
          expect.objectContaining({ data: undefined })
        );
        // Should NOT propagate the error — that's what produced the global toast.
        expect((result as { error?: unknown }).error).toBeUndefined();
      });

      it("logs the non-JSON response to console + PostHog (no toast)", async () => {
        mockInnerBaseQuery.mockResolvedValueOnce({
          error: {
            status: "PARSING_ERROR",
            originalStatus: 404,
            data: "<!DOCTYPE html>",
            error: "SyntaxError: ...",
          },
          meta: { request: {} as Request, response: {} as Response },
        });

        const baseQuery = backendBaseQuery("library/rotation");
        await baseQuery({ url: "/42/tracks" }, fakeApi, fakeExtra);

        expect(warnSpy).toHaveBeenCalled();
        expect(mockCaptureException).toHaveBeenCalledTimes(1);
        const capturedError = mockCaptureException.mock.calls[0][0] as Error;
        expect(capturedError).toBeInstanceOf(Error);
        expect(capturedError.message).toContain("library/rotation");
        expect(capturedError.message).toContain("/42/tracks");
      });

      it("does not swallow structured JSON 4xx errors", async () => {
        // Backend returned a proper JSON-encoded error — RTK Query treats this
        // as an HTTP error (status: 404 with parsed JSON body). Keep that
        // surfacing through; only PARSING_ERROR is soft-handled.
        const jsonError = {
          status: 404,
          data: { message: "rotation not found" },
        };
        mockInnerBaseQuery.mockResolvedValueOnce({
          error: jsonError,
          meta: { request: {} as Request, response: {} as Response },
        });

        const baseQuery = backendBaseQuery("library/rotation");
        const result = await baseQuery(
          { url: "/42/tracks" },
          fakeApi,
          fakeExtra
        );

        expect((result as { error: unknown }).error).toEqual(jsonError);
        expect((result as { data?: unknown }).data).toBeUndefined();
        expect(mockCaptureException).not.toHaveBeenCalled();
        expect(warnSpy).not.toHaveBeenCalled();
      });

      it("passes through successful responses unchanged", async () => {
        const success = {
          data: [{ position: "A1", title: "la paradoja", duration: null, artists: ["Juana Molina"] }],
          meta: { request: {} as Request, response: {} as Response },
        };
        mockInnerBaseQuery.mockResolvedValueOnce(success);

        const baseQuery = backendBaseQuery("library/rotation");
        const result = await baseQuery(
          { url: "/42/tracks" },
          fakeApi,
          fakeExtra
        );

        expect(result).toBe(success);
      });

      it("does not throw if PostHog capture fails (defensive)", async () => {
        mockCaptureException.mockImplementationOnce(() => {
          throw new Error("posthog not initialized");
        });
        mockInnerBaseQuery.mockResolvedValueOnce({
          error: {
            status: "PARSING_ERROR",
            originalStatus: 502,
            data: "<html>Bad Gateway</html>",
            error: "SyntaxError",
          },
          meta: { request: {} as Request, response: {} as Response },
        });

        const baseQuery = backendBaseQuery("library/rotation");
        await expect(
          baseQuery({ url: "/42/tracks" }, fakeApi, fakeExtra)
        ).resolves.toEqual(expect.objectContaining({ data: undefined }));
      });

      // Mutations must keep surfacing the error loudly. Soft-handling a POST
      // would mean "Add to flowsheet" / "Add album" / "Add to bin" silently
      // no-op if the backend route is missing — strictly worse UX than the
      // confusing toast. The soft-handle is only meant for list-shaped GET
      // reads.
      it.each(["POST", "PATCH", "DELETE", "PUT"])(
        "passes PARSING_ERROR through (loud) on %s mutations",
        async (method) => {
          mockInnerBaseQuery.mockResolvedValueOnce({
            error: {
              status: "PARSING_ERROR",
              originalStatus: 404,
              data: "<!DOCTYPE html>",
              error: "SyntaxError",
            },
            meta: { request: {} as Request, response: {} as Response },
          });

          const baseQuery = backendBaseQuery("flowsheet");
          const result = await baseQuery(
            { url: "/", method, body: { foo: "bar" } },
            fakeApi,
            fakeExtra
          );

          expect((result as { error?: unknown }).error).toEqual(
            expect.objectContaining({ status: "PARSING_ERROR" })
          );
          expect((result as { data?: unknown }).data).toBeUndefined();
          // No log noise either — caller (or rtkQueryErrorLogger) owns surfacing.
          expect(warnSpy).not.toHaveBeenCalled();
          expect(mockCaptureException).not.toHaveBeenCalled();
        }
      );

      // Escape hatch for a GET that wants loud failure anyway.
      it("respects extraOptions.surfaceNonJsonAsError as a per-endpoint opt-out", async () => {
        mockInnerBaseQuery.mockResolvedValueOnce({
          error: {
            status: "PARSING_ERROR",
            originalStatus: 404,
            data: "<!DOCTYPE html>",
            error: "SyntaxError",
          },
          meta: { request: {} as Request, response: {} as Response },
        });

        const baseQuery = backendBaseQuery("library/rotation");
        const result = await baseQuery(
          { url: "/42/tracks" },
          fakeApi,
          { surfaceNonJsonAsError: true }
        );

        expect((result as { error?: unknown }).error).toEqual(
          expect.objectContaining({ status: "PARSING_ERROR" })
        );
        expect((result as { data?: unknown }).data).toBeUndefined();
        expect(warnSpy).not.toHaveBeenCalled();
        expect(mockCaptureException).not.toHaveBeenCalled();
      });

      // Explicit `method: "GET"` (vs. the implicit-GET default) also gets the
      // soft-handle. Defends against a future refactor that starts setting
      // method explicitly on read queries.
      it("soft-handles explicit method: GET the same as implicit-GET", async () => {
        mockInnerBaseQuery.mockResolvedValueOnce({
          error: {
            status: "PARSING_ERROR",
            originalStatus: 404,
            data: "<!DOCTYPE html>",
            error: "SyntaxError",
          },
          meta: { request: {} as Request, response: {} as Response },
        });

        const baseQuery = backendBaseQuery("library/rotation");
        const result = await baseQuery(
          { url: "/42/tracks", method: "GET" },
          fakeApi,
          fakeExtra
        );

        expect((result as { data?: unknown }).data).toBeUndefined();
        expect((result as { error?: unknown }).error).toBeUndefined();
      });

      // String-form args (most concise GET shape RTK Query accepts) goes
      // through the GET branch too.
      it("soft-handles string-form args (RTK Query's GET shorthand)", async () => {
        mockInnerBaseQuery.mockResolvedValueOnce({
          error: {
            status: "PARSING_ERROR",
            originalStatus: 404,
            data: "<!DOCTYPE html>",
            error: "SyntaxError",
          },
          meta: { request: {} as Request, response: {} as Response },
        });

        const baseQuery = backendBaseQuery("library/rotation");
        const result = await baseQuery("/42/tracks", fakeApi, fakeExtra);

        expect((result as { data?: unknown }).data).toBeUndefined();
        expect((result as { error?: unknown }).error).toBeUndefined();
      });
    });
  });
});
