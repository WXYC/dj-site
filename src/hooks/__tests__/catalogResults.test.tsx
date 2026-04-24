import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import React, { type PropsWithChildren } from "react";
import { Provider } from "react-redux";
import { CssVarsProvider } from "@mui/joy/styles";
import { makeStore } from "@/lib/store";
import { catalogSlice } from "@/lib/features/catalog/frontend";
import type { SearchCatalogQueryParams } from "@/lib/features/catalog/types";

// Capture args passed to useSearchCatalogQuery on each call
const searchCatalogCalls: Array<{
  args: SearchCatalogQueryParams;
  options: { skip: boolean };
}> = [];

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
    return {
      data: undefined,
      isLoading: false,
      isSuccess: false,
      isError: false,
    };
  },
}));

vi.mock("../authenticationHooks", () => ({
  useAuthentication: () => ({ authenticating: false, authenticated: true }),
}));

import { useCatalogResults } from "../catalogHooks";

describe("useCatalogResults", () => {
  beforeEach(() => {
    searchCatalogCalls.length = 0;
  });

  it("should pass valid query params on mount when searchString persists from a previous visit", () => {
    const store = makeStore();

    // Simulate Redux state persisted from a previous catalog search
    store.dispatch(catalogSlice.actions.setSearchQuery("Autechre"));

    function Wrapper({ children }: PropsWithChildren) {
      return (
        <Provider store={store}>
          <CssVarsProvider>{children}</CssVarsProvider>
        </Provider>
      );
    }

    renderHook(() => useCatalogResults(), { wrapper: Wrapper });

    // On the first render, useSearchCatalogQuery is called.
    // With searchString="Autechre" (persisted), skip should be false.
    // The query args should have valid artist_name/album_title (not undefined),
    // because sending undefined params causes a 400 from the backend (?n=10 only).
    const firstCall = searchCatalogCalls[0];

    expect(firstCall.options.skip).toBe(false);
    expect(firstCall.args.artist_name).not.toBeUndefined();
    expect(firstCall.args.album_title).not.toBeUndefined();
  });
});
