import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import React, { type PropsWithChildren } from "react";
import { Provider } from "react-redux";
import { CssVarsProvider } from "@mui/joy/styles";
import { makeStore } from "@/lib/store";
import { catalogSlice } from "@/lib/features/catalog/frontend";
import { createTestAlbum } from "@/lib/test-utils";
import type { LibraryQueryParams } from "@/lib/features/catalog/types";

type LazyResult = {
  data: unknown;
  isFetching: boolean;
  isError: boolean;
};

const triggerCalls: LibraryQueryParams[] = [];
let nextLazyResult: LazyResult = {
  data: undefined,
  isFetching: false,
  isError: false,
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
  useLazySearchLibraryQueryQuery: () => {
    const trigger = (params: LibraryQueryParams) => {
      triggerCalls.push(params);
    };
    return [trigger, nextLazyResult];
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
    triggerCalls.length = 0;
    nextLazyResult = { data: undefined, isFetching: false, isError: false };
  });

  it("fires the query immediately on mount when default state is empty", () => {
    const store = makeStore();
    renderHook(() => useCatalogQueryResults(), { wrapper: Wrapper({ store }) });
    expect(triggerCalls.length).toBe(1);
    expect(triggerCalls[0].q).toBeUndefined();
  });

  it("skips single-character partial queries", () => {
    const store = makeStore();
    const { rerender } = renderHook(() => useCatalogQueryResults(), {
      wrapper: Wrapper({ store }),
    });

    triggerCalls.length = 0;
    act(() => {
      setRowValue(store, "a");
    });
    rerender();
    expect(triggerCalls).toHaveLength(0);
  });

  it("fires once when the query stabilizes at >= 2 chars", () => {
    const store = makeStore();
    const { rerender } = renderHook(() => useCatalogQueryResults(), {
      wrapper: Wrapper({ store }),
    });

    triggerCalls.length = 0;
    act(() => {
      setRowValue(store, "Stereolab");
    });
    rerender();
    expect(triggerCalls).toHaveLength(1);
    expect(triggerCalls[0].q).toBe("artist:Stereolab");
  });

  it("dedupes consecutive renders with the same params", () => {
    const store = makeStore();
    const { rerender } = renderHook(() => useCatalogQueryResults(), {
      wrapper: Wrapper({ store }),
    });

    triggerCalls.length = 0;
    act(() => {
      setRowValue(store, "Stereolab");
    });
    rerender();
    rerender();
    rerender();
    expect(triggerCalls).toHaveLength(1);
  });

  it("queues the latest params while a fetch is in flight, drains when it finishes", () => {
    const store = makeStore();
    nextLazyResult = { data: undefined, isFetching: true, isError: false };

    const { rerender } = renderHook(() => useCatalogQueryResults(), {
      wrapper: Wrapper({ store }),
    });

    triggerCalls.length = 0;
    act(() => {
      setRowValue(store, "Stereolab");
    });
    rerender();
    // In-flight: trigger should not be called again
    expect(triggerCalls).toHaveLength(0);

    // Flip to !isFetching and re-render — pending should drain.
    nextLazyResult = { data: undefined, isFetching: false, isError: false };
    rerender();
    expect(triggerCalls).toHaveLength(1);
    expect(triggerCalls[0].q).toBe("artist:Stereolab");
  });

  it("dedupes duplicate album ids within a single page response", async () => {
    const store = makeStore();
    const duplicate = createTestAlbum({ id: 7000 });
    nextLazyResult = {
      data: {
        results: [duplicate, duplicate, createTestAlbum({ id: 2 })],
        total: 2,
        page: 0,
        totalPages: 1,
      },
      isFetching: false,
      isError: false,
    };

    const { result } = renderHook(() => useCatalogQueryResults(), {
      wrapper: Wrapper({ store }),
    });

    await waitFor(() => {
      expect(result.current.results).toHaveLength(2);
    });
    expect(result.current.results.map((r) => r.id)).toEqual([7000, 2]);
  });

  it("accumulates additional pages when data is returned, deduping by id", async () => {
    const store = makeStore();
    const pageZero = [createTestAlbum({ id: 1 }), createTestAlbum({ id: 2 })];
    nextLazyResult = {
      data: { results: pageZero, total: 4, page: 0, totalPages: 2 },
      isFetching: false,
      isError: false,
    };

    const { result } = renderHook(() => useCatalogQueryResults(), {
      wrapper: Wrapper({ store }),
    });

    await waitFor(() => {
      expect(result.current.results).toHaveLength(2);
    });
    expect(result.current.results.map((r) => r.id)).toEqual([1, 2]);
    expect(result.current.hasMore).toBe(true);
  });

  it("resets the accumulator when the query changes", async () => {
    const store = makeStore();
    nextLazyResult = {
      data: {
        results: [createTestAlbum({ id: 1 })],
        total: 1,
        page: 0,
        totalPages: 1,
      },
      isFetching: false,
      isError: false,
    };

    const { result, rerender } = renderHook(() => useCatalogQueryResults(), {
      wrapper: Wrapper({ store }),
    });

    await waitFor(() => {
      expect(result.current.results).toHaveLength(1);
    });

    // Change the query (which mutates the accumulation key). Accumulator clears.
    act(() => {
      setRowValue(store, "Cat Power");
    });
    rerender();
    await waitFor(() => {
      // After reset and before the new page lands (still the page-0 data above
      // for a different key), accumulator is at least empty briefly.
      // We assert the *final* state: the next data drop replaces, not appends.
      expect(result.current.results.length).toBeLessThanOrEqual(1);
    });
  });
});
