import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import React, { type PropsWithChildren } from "react";
import { Provider } from "react-redux";
import { CssVarsProvider } from "@mui/joy/styles";
import { makeStore } from "@/lib/store";
import { catalogSlice } from "@/lib/features/catalog/frontend";
import { createTestAlbum } from "@/lib/test-utils";
import type { CatalogInfiniteQueryArg } from "@/lib/features/catalog/api";

type InfiniteQueryResult = {
  data: { pages: Array<{ results: ReturnType<typeof createTestAlbum>[]; total: number; page: number; totalPages: number }> } | undefined;
  isFetching: boolean;
  isError: boolean;
  hasNextPage: boolean;
  fetchNextPage: ReturnType<typeof vi.fn>;
};

let infiniteQueryEnabled = false;
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
  useSearchLibraryQueryInfiniteQuery: (
    queryArg: CatalogInfiniteQueryArg,
    options?: { skip?: boolean },
  ) => {
    lastQueryArg = queryArg;
    if (options?.skip) {
      return {
        data: undefined,
        isFetching: false,
        isError: false,
        hasNextPage: false,
        fetchNextPage: vi.fn(),
      };
    }
    infiniteQueryEnabled = true;
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

vi.mock("../authenticationHooks", () => ({
  useAuthentication: () => ({ authenticating: false, authenticated: true }),
}));

import { useCatalogQueryResults } from "../catalogHooks";

function Wrapper({
  store,
}: {
  store: ReturnType<typeof makeStore>;
}): (props: PropsWithChildren) => React.ReactElement {
  return ({ children }) => (
    <Provider store={store}>
      <CssVarsProvider>{children}</CssVarsProvider>
    </Provider>
  );
}

function setRowValue(store: ReturnType<typeof makeStore>, value: string) {
  const state = store.getState();
  const id = state.catalog.rows[0].id;
  store.dispatch(
    catalogSlice.actions.updateRow({ id, updates: { field: "artist", value } }),
  );
}

describe("useCatalogQueryResults", () => {
  beforeEach(() => {
    infiniteQueryEnabled = false;
    lastQueryArg = undefined;
    nextInfiniteResult = {
      data: undefined,
      isFetching: false,
      isError: false,
      hasNextPage: false,
      fetchNextPage: vi.fn(),
    };
  });

  it("skips the infinite query until browse or filters/search intent", () => {
    const store = makeStore();
    renderHook(() => useCatalogQueryResults(), { wrapper: Wrapper({ store }) });
    expect(infiniteQueryEnabled).toBe(false);
  });

  it("enables the query when browse is engaged with an empty query", () => {
    const store = makeStore();
    const { rerender } = renderHook(() => useCatalogQueryResults(), {
      wrapper: Wrapper({ store }),
    });
    act(() => {
      store.dispatch(catalogSlice.actions.engageBrowse());
    });
    rerender();
    expect(infiniteQueryEnabled).toBe(true);
    expect(lastQueryArg?.q).toBeUndefined();
  });

  it("skips single-character partial queries", () => {
    const store = makeStore();
    const { rerender } = renderHook(() => useCatalogQueryResults(), {
      wrapper: Wrapper({ store }),
    });

    act(() => {
      store.dispatch(catalogSlice.actions.engageBrowse());
      setRowValue(store, "a");
    });
    rerender();
    expect(infiniteQueryEnabled).toBe(false);
  });

  it("enables the query when the query stabilizes at >= 2 chars", () => {
    const store = makeStore();
    const { rerender } = renderHook(() => useCatalogQueryResults(), {
      wrapper: Wrapper({ store }),
    });

    act(() => {
      setRowValue(store, "Stereolab");
    });
    rerender();
    expect(infiniteQueryEnabled).toBe(true);
    expect(lastQueryArg?.q).toBe("artist:Stereolab");
  });

  it("dedupes duplicate album ids across flattened pages", async () => {
    const store = makeStore();
    const duplicate = createTestAlbum({ id: 7000 });
    nextInfiniteResult = {
      data: {
        pages: [
          {
            results: [duplicate, duplicate, createTestAlbum({ id: 2 })],
            total: 2,
            page: 0,
            totalPages: 1,
          },
        ],
      },
      isFetching: false,
      isError: false,
      hasNextPage: false,
      fetchNextPage: vi.fn(),
    };

    act(() => {
      store.dispatch(catalogSlice.actions.engageBrowse());
    });

    const { result } = renderHook(() => useCatalogQueryResults(), {
      wrapper: Wrapper({ store }),
    });

    await waitFor(() => {
      expect(result.current.results).toHaveLength(2);
    });
    expect(result.current.results.map((r) => r.id)).toEqual([7000, 2]);
  });

  it("flattens multiple pages and exposes hasNextPage", async () => {
    const store = makeStore();
    const pageZero = [createTestAlbum({ id: 1 }), createTestAlbum({ id: 2 })];
    nextInfiniteResult = {
      data: {
        pages: [{ results: pageZero, total: 4, page: 0, totalPages: 2 }],
      },
      isFetching: false,
      isError: false,
      hasNextPage: true,
      fetchNextPage: vi.fn(),
    };

    act(() => {
      store.dispatch(catalogSlice.actions.engageBrowse());
    });

    const { result } = renderHook(() => useCatalogQueryResults(), {
      wrapper: Wrapper({ store }),
    });

    await waitFor(() => {
      expect(result.current.results).toHaveLength(2);
    });
    expect(result.current.hasNextPage).toBe(true);
    expect(result.current.isLoadingInitial).toBe(false);
    expect(result.current.isFetchingMore).toBe(false);
  });

  it("sets isLoadingInitial while fetching with no pages yet", () => {
    const store = makeStore();
    nextInfiniteResult = {
      data: undefined,
      isFetching: true,
      isError: false,
      hasNextPage: false,
      fetchNextPage: vi.fn(),
    };

    act(() => {
      store.dispatch(catalogSlice.actions.engageBrowse());
    });

    const { result } = renderHook(() => useCatalogQueryResults(), {
      wrapper: Wrapper({ store }),
    });

    expect(result.current.isLoadingInitial).toBe(true);
    expect(result.current.isFetchingMore).toBe(false);
  });

  it("sets isFetchingMore while fetching with existing pages", async () => {
    const store = makeStore();
    nextInfiniteResult = {
      data: {
        pages: [
          {
            results: [createTestAlbum({ id: 1 })],
            total: 2,
            page: 0,
            totalPages: 2,
          },
        ],
      },
      isFetching: true,
      isError: false,
      hasNextPage: true,
      fetchNextPage: vi.fn(),
    };

    act(() => {
      store.dispatch(catalogSlice.actions.engageBrowse());
    });

    const { result } = renderHook(() => useCatalogQueryResults(), {
      wrapper: Wrapper({ store }),
    });

    await waitFor(() => {
      expect(result.current.isFetchingMore).toBe(true);
    });
    expect(result.current.isLoadingInitial).toBe(false);
  });
});
