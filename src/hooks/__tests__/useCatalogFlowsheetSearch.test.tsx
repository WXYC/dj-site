import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import React, { type PropsWithChildren } from "react";
import { Provider } from "react-redux";
import { CssVarsProvider } from "@mui/joy/styles";
import { makeStore } from "@/lib/store";
import { flowsheetSlice } from "@/lib/features/flowsheet/frontend";
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
  options: { skip?: boolean };
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
  useLazySearchLibraryQueryQuery: () => [() => {}, nextQueryResult],
  useSearchCatalogQuery: (
    args: SearchCatalogQueryParams,
    options: { skip?: boolean }
  ) => {
    searchCatalogCalls.push({ args, options });
    return nextQueryResult;
  },
}));

vi.mock("../authenticationHooks", () => ({
  useAuthentication: () => ({ authenticating: false, authenticated: true }),
}));

import { useCatalogFlowsheetSearch } from "../catalogHooks";

function Wrapper({
  store,
}: {
  store: ReturnType<typeof makeStore>;
}): (props: PropsWithChildren) => React.ReactElement {
  return function WrapperInner({ children }) {
    return (
      <Provider store={store}>
        <CssVarsProvider>{children}</CssVarsProvider>
      </Provider>
    );
  };
}

function renderWithQuery(query: { artist: string; album: string }) {
  const store = makeStore();
  store.dispatch(
    flowsheetSlice.actions.setSearchProperty({ name: "artist", value: query.artist })
  );
  store.dispatch(
    flowsheetSlice.actions.setSearchProperty({ name: "album", value: query.album })
  );
  return renderHook(() => useCatalogFlowsheetSearch(), {
    wrapper: Wrapper({ store }),
  });
}

describe("useCatalogFlowsheetSearch", () => {
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

  describe("compilation-indicator short-circuit", () => {
    it.each([
      ["Various Artists", "In-Correcto 15-25"],
      ["various artists", "Some Album"],
      ["V/A", "Some Album"],
      ["v.a.", "Some Album"],
      ["Soundtrack", "Movie Title"],
      ["Compilation", "Best Of"],
    ])(
      "passes skip=true and returns [] for artist=%s album=%s",
      (artist, album) => {
        const { result } = renderWithQuery({ artist, album });

        const lastCall = searchCatalogCalls.at(-1);
        expect(lastCall?.options.skip).toBe(true);
        expect(result.current.searchResults).toEqual([]);
      }
    );

    it("does not short-circuit when artist is a legitimate name", () => {
      const { result } = renderWithQuery({
        artist: "Juana Molina",
        album: "DOGA",
      });

      const lastCall = searchCatalogCalls.at(-1);
      expect(lastCall?.options.skip).toBe(false);
      // No data was returned by the mock; expect empty results but the
      // network call should have been allowed through (skip=false).
      expect(result.current.searchResults).toEqual([]);
    });

    it("does not short-circuit on album-only field 'Various Artists Comp'", () => {
      const { result } = renderWithQuery({
        artist: "Some Artist",
        album: "Various Artists Compilation Vol 5",
      });

      const lastCall = searchCatalogCalls.at(-1);
      expect(lastCall?.options.skip).toBe(false);
      expect(result.current.searchResults).toEqual([]);
    });
  });
});
