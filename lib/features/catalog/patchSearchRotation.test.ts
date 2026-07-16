import { describe, expect, it, vi, afterEach } from "vitest";
import { patchCatalogSearchRotation } from "./patchSearchCaches";
import { catalogApi } from "./api";
import { catalogSlice } from "./frontend";
import { createTestAlbum } from "@/tests/helpers";

describe("patchCatalogSearchRotation", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("updates rotation fields on cached search rows", () => {
    const dispatch = vi.fn();
    const queryArgs = { q: "artist:Test" };
    const album = createTestAlbum({ id: 900 });

    vi.spyOn(catalogApi.util, "selectCachedArgsForQuery").mockReturnValue([
      queryArgs,
    ]);

    vi.spyOn(catalogApi.util, "updateQueryData").mockImplementation(
      (_endpoint, args, updater) => {
        expect(args).toEqual(queryArgs);
        const draft = {
          pages: [
            {
              results: [album],
              total: 1,
              page: 0,
              totalPages: 1,
            },
          ],
        };
        updater(draft);
        expect(draft.pages[0].results[0].rotation_bin).toBe("H");
        expect(draft.pages[0].results[0].rotation_id).toBe(12);
        return { type: "catalogApi/updateQueryData" } as never;
      },
    );

    patchCatalogSearchRotation(dispatch, () => ({} as never), 900, {
      rotation_bin: "H",
      rotation_id: 12,
    });

    expect(dispatch).toHaveBeenCalled();
    expect(dispatch).toHaveBeenCalledWith(
      catalogSlice.actions.setAlbumRotation({
        albumId: 900,
        rotation_bin: "H",
        rotation_id: 12,
      }),
    );
  });

  it("inserts the album when rotation filter matches and row was absent", () => {
    const dispatch = vi.fn();
    const queryArgs = { rotation_bins: "H" };
    const album = createTestAlbum({
      id: 42,
      rotation_bin: "H",
      rotation_id: 99,
      title: "New Heavy LP",
    });

    vi.spyOn(catalogApi.util, "selectCachedArgsForQuery").mockReturnValue([
      queryArgs,
    ]);

    vi.spyOn(catalogApi.endpoints.getInformation, "select").mockReturnValue(
      (() => () => undefined) as unknown as ReturnType<
        typeof catalogApi.endpoints.getInformation.select
      >,
    );

    vi.spyOn(catalogApi.util, "updateQueryData").mockImplementation(
      (_endpoint, args, updater) => {
        expect(args).toEqual(queryArgs);
        const draft = {
          pages: [
            {
              results: [createTestAlbum({ id: 1, rotation_bin: "H" })],
              total: 1,
              page: 0,
              totalPages: 1,
            },
          ],
        };
        updater(draft);
        expect(draft.pages[0].results).toHaveLength(2);
        expect(draft.pages[0].results[0].id).toBe(42);
        expect(draft.pages[0].results[0].rotation_bin).toBe("H");
        expect(draft.pages[0].total).toBe(2);
        return { type: "catalogApi/updateQueryData" } as never;
      },
    );

    patchCatalogSearchRotation(
      dispatch,
      () => ({} as never),
      42,
      { rotation_bin: "H", rotation_id: 99 },
      album,
    );
  });
});
