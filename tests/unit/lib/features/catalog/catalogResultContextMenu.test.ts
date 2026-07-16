import { describe, expect, it } from "vitest";
import { catalogSlice, defaultCatalogFrontendState } from "@/lib/features/catalog/frontend";

describe("catalogSlice result context menu", () => {
  it("openResultContextMenu stores a single menu target", () => {
    const state = catalogSlice.reducer(
      defaultCatalogFrontendState,
      catalogSlice.actions.openResultContextMenu({
        albumId: 1,
        top: 10,
        left: 20,
      }),
    );

    expect(state.resultContextMenu).toEqual({
      albumId: 1,
      top: 10,
      left: 20,
    });
  });

  it("opening another row replaces the previous menu", () => {
    let state = catalogSlice.reducer(
      defaultCatalogFrontendState,
      catalogSlice.actions.openResultContextMenu({
        albumId: 1,
        top: 10,
        left: 20,
      }),
    );
    state = catalogSlice.reducer(
      state,
      catalogSlice.actions.openResultContextMenu({
        albumId: 2,
        top: 30,
        left: 40,
      }),
    );

    expect(state.resultContextMenu).toEqual({
      albumId: 2,
      top: 30,
      left: 40,
    });
  });

  it("closeResultContextMenu clears the menu", () => {
    let state = catalogSlice.reducer(
      defaultCatalogFrontendState,
      catalogSlice.actions.openResultContextMenu({
        albumId: 1,
        top: 0,
        left: 0,
      }),
    );
    state = catalogSlice.reducer(
      state,
      catalogSlice.actions.closeResultContextMenu(),
    );

    expect(state.resultContextMenu).toBeNull();
  });
});
