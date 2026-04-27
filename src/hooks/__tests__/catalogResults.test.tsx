import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import React, { type PropsWithChildren } from "react";
import { Provider } from "react-redux";
import { CssVarsProvider } from "@mui/joy/styles";
import { makeStore } from "@/lib/store";
import { catalogSlice } from "@/lib/features/catalog/frontend";
import type { SearchCatalogQueryParams } from "@/lib/features/catalog/types";

type QueryResult = {
  data: unknown;
  isFetching: boolean;
  isLoading: boolean;
  isSuccess: boolean;
  isError: boolean;
};

const searchCatalogCalls: Array<{
  args: SearchCatalogQueryParams;
  options: { skip: boolean };
}> = [];

let nextQueryResult: QueryResult = {
  data: undefined,
  isFetching: false,
  isLoading: false,
  isSuccess: false,
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
  useSearchCatalogQuery: (
    args: SearchCatalogQueryParams,
    options: { skip: boolean }
  ) => {
    searchCatalogCalls.push({ args, options });
    return nextQueryResult;
  },
}));

vi.mock("../authenticationHooks", () => ({
  useAuthentication: () => ({ authenticating: false, authenticated: true }),
}));

import { useCatalogResults } from "../catalogHooks";

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

describe("useCatalogResults", () => {
  beforeEach(() => {
    searchCatalogCalls.length = 0;
    nextQueryResult = {
      data: undefined,
      isFetching: false,
      isLoading: false,
      isSuccess: false,
      isError: false,
    };
  });

  it("should pass valid query params on mount when searchString persists from a previous visit", () => {
    const store = makeStore();
    store.dispatch(catalogSlice.actions.setSearchQuery("Autechre"));

    renderHook(() => useCatalogResults(), { wrapper: Wrapper({ store }) });

    const firstCall = searchCatalogCalls[0];
    expect(firstCall.options.skip).toBe(false);
    expect(firstCall.args.artist_name).not.toBeUndefined();
    expect(firstCall.args.album_title).not.toBeUndefined();
  });

  describe("loading state", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it("should not show loading when searchString is below the minimum", () => {
      const store = makeStore();
      const { result } = renderHook(() => useCatalogResults(), {
        wrapper: Wrapper({ store }),
      });

      expect(result.current.loading).toBe(false);

      act(() => {
        store.dispatch(catalogSlice.actions.setSearchQuery("a"));
      });
      act(() => {
        vi.advanceTimersByTime(600);
      });

      expect(result.current.loading).toBe(false);
    });

    it("should not stay stuck on loading after a successful query when persisted searchString triggers an immediate fetch", () => {
      const store = makeStore();
      store.dispatch(catalogSlice.actions.setSearchQuery("Autechre"));

      // Simulate the query already having succeeded by the time the hook mounts
      // (cache hit from a prior session) — isFetching=false, data populated.
      nextQueryResult = {
        data: [],
        isFetching: false,
        isLoading: false,
        isSuccess: true,
        isError: false,
      };

      const { result } = renderHook(() => useCatalogResults(), {
        wrapper: Wrapper({ store }),
      });

      expect(result.current.loading).toBe(false);

      // Advance past the previous debounce window — loading must not flip true.
      act(() => {
        vi.advanceTimersByTime(1000);
      });

      expect(result.current.loading).toBe(false);
    });
  });
});
