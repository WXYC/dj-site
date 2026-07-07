import { describe, expect, it } from "vitest";
import { catalogSlice, defaultCatalogFrontendState } from "./frontend";

describe("catalogSlice rotation state", () => {
  it("setAlbumRotation stores per-album rotation", () => {
    const state = catalogSlice.reducer(
      defaultCatalogFrontendState,
      catalogSlice.actions.setAlbumRotation({
        albumId: 42,
        rotation_bin: "M",
        rotation_id: 99,
      }),
    );

    expect(state.rotationByAlbumId[42]).toEqual({
      rotation_bin: "M",
      rotation_id: 99,
    });
  });

  it("clearAlbumRotation removes the entry", () => {
    let state = catalogSlice.reducer(
      defaultCatalogFrontendState,
      catalogSlice.actions.setAlbumRotation({
        albumId: 42,
        rotation_bin: "H",
        rotation_id: 1,
      }),
    );
    state = catalogSlice.reducer(
      state,
      catalogSlice.actions.clearAlbumRotation(42),
    );

    expect(state.rotationByAlbumId[42]).toBeUndefined();
  });

  it("setFilter preserves rotationByAlbumId when filters change", () => {
    let state = catalogSlice.reducer(
      defaultCatalogFrontendState,
      catalogSlice.actions.setAlbumRotation({
        albumId: 42,
        rotation_bin: "M",
        rotation_id: 99,
      }),
    );
    state = catalogSlice.reducer(
      state,
      catalogSlice.actions.setFilter({ onStreaming: false }),
    );
    expect(state.rotationByAlbumId[42]).toEqual({
      rotation_bin: "M",
      rotation_id: 99,
    });
    expect(state.filters.onStreaming).toBe(false);
  });
});
