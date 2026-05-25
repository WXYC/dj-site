import { describe, expect, it, vi, afterEach } from "vitest";
import { patchCatalogSearchRotation } from "./patchSearchCaches";
import { catalogApi } from "./api";
import { catalogSlice } from "./frontend";
import { createTestAlbum } from "@/lib/test-utils";

describe("patchCatalogSearchRotation", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("updates rotation fields on cached search rows", () => {
    const dispatch = vi.fn();
    const queryArgs = { page: 0, limit: 25 };
    const album = createTestAlbum({ id: 900 });

    vi.spyOn(catalogApi.util, "selectCachedArgsForQuery").mockReturnValue([
      queryArgs,
    ]);

    vi.spyOn(catalogApi.util, "updateQueryData").mockImplementation(
      (_endpoint, args, updater) => {
        expect(args).toEqual(queryArgs);
        const draft = {
          results: [album],
          total: 1,
          page: 0,
          totalPages: 1,
        };
        updater(draft);
        expect(draft.results[0].rotation_bin).toBe("H");
        expect(draft.results[0].rotation_id).toBe(12);
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
});
