import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type { PropsWithChildren, ReactElement } from "react";
import { Provider } from "react-redux";
import { CssVarsProvider } from "@mui/joy/styles";
import { makeStore } from "@/lib/store";
import { CATALOG_QUERY_MAX_LIMIT } from "@/lib/features/catalog/constants";
import { createTestAlbumSearchResult, server, TEST_BACKEND_URL } from "@/tests/helpers";

// The real better-auth client installs listeners whose teardown is deferred a
// second past the last subscriber; a short file finishes inside that second.
vi.mock("@/lib/features/authentication/client", async () => {
  const { createAuthClientModuleMock } = await import(
    "@/tests/helpers/auth-client-mock"
  );
  return createAuthClientModuleMock();
});

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

let authState = { authenticating: false, authenticated: true };
vi.mock("@/src/hooks/authenticationHooks", () => ({
  useAuthentication: () => authState,
}));

import { useMissingReleases } from "@/src/hooks/catalogHooks";

function Wrapper({
  store,
}: {
  store: ReturnType<typeof makeStore>;
}): (props: PropsWithChildren) => ReactElement {
  return ({ children }) => (
    <Provider store={store}>
      <CssVarsProvider>{children}</CssVarsProvider>
    </Provider>
  );
}

function renderMissingReleases() {
  return renderHook(() => useMissingReleases(), {
    wrapper: Wrapper({ store: makeStore() }),
  });
}

/** Serve one page of `/library/query` and record every request that reaches it. */
function mockLibraryQuery(
  page: { rows: number; total: number } | { status: number },
) {
  const requestUrls: URL[] = [];
  server.use(
    http.get(`${TEST_BACKEND_URL}/library/query`, ({ request }) => {
      requestUrls.push(new URL(request.url));
      if ("status" in page) {
        return HttpResponse.json({ message: null }, { status: page.status });
      }
      return HttpResponse.json({
        results: Array.from({ length: page.rows }, (_, i) =>
          createTestAlbumSearchResult({
            id: 8000 + i,
            album_title: `Missing Release ${i}`,
            date_lost: "2026-07-01",
          }),
        ),
        total: page.total,
        page: 0,
        totalPages: Math.max(1, Math.ceil(page.total / CATALOG_QUERY_MAX_LIMIT)),
      });
    }),
  );
  return requestUrls;
}

describe("useMissingReleases", () => {
  beforeEach(() => {
    authState = { authenticating: false, authenticated: true };
  });

  it("issues no request while authentication is still settling, and reports that as loading rather than empty", async () => {
    authState = { authenticating: true, authenticated: false };
    const requestUrls = mockLibraryQuery({ rows: 1, total: 1 });

    const { result, rerender } = renderMissingReleases();

    expect(requestUrls).toHaveLength(0);
    // The uninitialized substate must never read as "there are none".
    expect(result.current.isLoading).toBe(true);
    expect(result.current.results).toEqual([]);

    authState = { authenticating: false, authenticated: true };
    rerender();

    await waitFor(() => expect(result.current.results).toHaveLength(1));
    expect(requestUrls).toHaveLength(1);
  });

  it("stays skipped for a settled but unauthenticated session", () => {
    authState = { authenticating: false, authenticated: false };
    const requestUrls = mockLibraryQuery({ rows: 1, total: 1 });

    const { result } = renderMissingReleases();

    expect(requestUrls).toHaveLength(0);
    expect(result.current.isLoading).toBe(true);
  });

  it("progresses uninitialized -> loading -> loaded, reporting the server total", async () => {
    mockLibraryQuery({ rows: 2, total: 2 });

    const { result } = renderMissingReleases();

    expect(result.current.isLoading).toBe(true);
    expect(result.current.isError).toBe(false);

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.results).toHaveLength(2);
    expect(result.current.total).toBe(2);
    expect(result.current.isRefreshing).toBe(false);
    expect(result.current.isTruncated).toBe(false);
  });

  it("asks for one page at the endpoint's maximum limit", async () => {
    const requestUrls = mockLibraryQuery({ rows: 1, total: 1 });

    const { result } = renderMissingReleases();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(requestUrls).toHaveLength(1);
    expect(requestUrls[0].searchParams.get("missing")).toBe("true");
    expect(requestUrls[0].searchParams.get("limit")).toBe(
      String(CATALOG_QUERY_MAX_LIMIT),
    );
  });

  it("issues exactly one request — a page it cannot fully load is not retried or advanced", async () => {
    const requestUrls = mockLibraryQuery({
      rows: CATALOG_QUERY_MAX_LIMIT,
      total: CATALOG_QUERY_MAX_LIMIT * 4,
    });

    const { result } = renderMissingReleases();
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(requestUrls).toHaveLength(1);
  });

  it("surfaces a failed request as an error, not as an empty shelf", async () => {
    const requestUrls = mockLibraryQuery({ status: 500 });

    const { result } = renderMissingReleases();

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.isLoading).toBe(false);
    expect(result.current.results).toEqual([]);

    // A rejection must not re-arm the request: the failing page was retried
    // without bound by the cascade this hook replaced.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(requestUrls).toHaveLength(1);
  });

  it.each([
    { rows: 2, total: 2, isTruncated: false },
    { rows: 2, total: 3, isTruncated: true },
    { rows: CATALOG_QUERY_MAX_LIMIT, total: CATALOG_QUERY_MAX_LIMIT, isTruncated: false },
    { rows: CATALOG_QUERY_MAX_LIMIT, total: CATALOG_QUERY_MAX_LIMIT + 1, isTruncated: true },
  ])(
    "reports isTruncated=$isTruncated for $rows rows against a total of $total",
    async ({ rows, total, isTruncated }) => {
      mockLibraryQuery({ rows, total });

      const { result } = renderMissingReleases();
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.results).toHaveLength(rows);
      expect(result.current.total).toBe(total);
      expect(result.current.isTruncated).toBe(isTruncated);
    },
  );
});
