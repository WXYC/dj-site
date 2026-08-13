import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import type { PropsWithChildren, ReactElement } from "react";
import { Provider } from "react-redux";
import { CssVarsProvider } from "@mui/joy/styles";
import { makeStore } from "@/lib/store";
import { createTestAlbum } from "@/tests/helpers";
import type { CatalogInfiniteQueryArg } from "@/lib/features/catalog/api";

type InfiniteQueryResult = {
  data: { pages: Array<{ results: ReturnType<typeof createTestAlbum>[]; total: number; page: number; totalPages: number }> } | undefined;
  isFetching: boolean;
  isError: boolean;
  hasNextPage: boolean;
  fetchNextPage: ReturnType<typeof vi.fn>;
};

let lastQueryArg: CatalogInfiniteQueryArg | undefined;
let nextInfiniteResult: InfiniteQueryResult = {
  data: undefined,
  isFetching: false,
  isError: false,
  hasNextPage: false,
  fetchNextPage: vi.fn(),
};

vi.mock("@/lib/features/catalog/api", () => ({
  catalogApi: {
    reducerPath: "catalogApi",
    reducer: (state = {}) => state,
    middleware:
      () =>
      (next: (action: unknown) => unknown) =>
      (action: unknown) =>
        next(action),
    endpoints: {},
    util: { resetApiState: () => ({ type: "noop" }) },
  },
  useSearchLibraryQueryInfiniteQuery: (queryArg: CatalogInfiniteQueryArg) => {
    lastQueryArg = queryArg;
    return nextInfiniteResult;
  },
  useSearchCatalogQuery: () => ({
    data: undefined,
    isFetching: false,
    isLoading: false,
    isSuccess: false,
    isError: false,
  }),
}));

vi.mock("@/src/hooks/authenticationHooks", () => ({
  useAuthentication: () => ({ authenticating: false, authenticated: true }),
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

describe("useMissingReleases", () => {
  beforeEach(() => {
    lastQueryArg = undefined;
    nextInfiniteResult = {
      data: undefined,
      isFetching: false,
      isError: false,
      hasNextPage: false,
      fetchNextPage: vi.fn(),
    };
  });

  it("always queries with missing: true, unconditionally", () => {
    const store = makeStore();
    renderHook(() => useMissingReleases(), { wrapper: Wrapper({ store }) });
    expect(lastQueryArg).toEqual({ missing: true });
  });

  it("flattens and dedupes results across pages, reporting the server total", () => {
    const store = makeStore();
    const duplicate = createTestAlbum({ id: 7000 });
    nextInfiniteResult = {
      data: {
        pages: [
          { results: [duplicate, duplicate, createTestAlbum({ id: 2 })], total: 2, page: 0, totalPages: 1 },
        ],
      },
      isFetching: false,
      isError: false,
      hasNextPage: false,
      fetchNextPage: vi.fn(),
    };

    const { result } = renderHook(() => useMissingReleases(), {
      wrapper: Wrapper({ store }),
    });

    expect(result.current.results.map((r) => r.id)).toEqual([7000, 2]);
    expect(result.current.total).toBe(2);
  });

  it("auto-advances through every page with no pagination UI to drive it", async () => {
    const store = makeStore();
    const fetchNextPage = vi.fn();
    nextInfiniteResult = {
      data: {
        pages: [{ results: [createTestAlbum({ id: 1 })], total: 2, page: 0, totalPages: 2 }],
      },
      isFetching: false,
      isError: false,
      hasNextPage: true,
      fetchNextPage,
    };

    renderHook(() => useMissingReleases(), { wrapper: Wrapper({ store }) });

    await waitFor(() => {
      expect(fetchNextPage).toHaveBeenCalled();
    });
  });

  it("does not advance while a page is already in flight", () => {
    const store = makeStore();
    const fetchNextPage = vi.fn();
    nextInfiniteResult = {
      data: {
        pages: [{ results: [createTestAlbum({ id: 1 })], total: 2, page: 0, totalPages: 2 }],
      },
      isFetching: true,
      isError: false,
      hasNextPage: true,
      fetchNextPage,
    };

    renderHook(() => useMissingReleases(), { wrapper: Wrapper({ store }) });

    expect(fetchNextPage).not.toHaveBeenCalled();
  });

  it("reports isLoading only for the initial (page-less) fetch", () => {
    const store = makeStore();
    nextInfiniteResult = {
      data: undefined,
      isFetching: true,
      isError: false,
      hasNextPage: false,
      fetchNextPage: vi.fn(),
    };

    const { result } = renderHook(() => useMissingReleases(), {
      wrapper: Wrapper({ store }),
    });

    expect(result.current.isLoading).toBe(true);
  });
});
