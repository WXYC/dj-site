import { describe, expect, it, vi, afterEach } from "vitest";
import { patchCatalogSearchCaches } from "./patchSearchCaches";
import { catalogApi } from "./api";
import { catalogSlice } from "./frontend";
import { createTestAlbum } from "@/lib/test-utils";

describe("patchCatalogSearchCaches", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("removes a row that no longer matches the cached missing filter after mark-found", () => {
    const dispatch = vi.fn();
    const queryArgs = { missing: true };
    const existing = createTestAlbum({
      id: 42,
      date_lost: "2024-01-01",
      date_found: undefined,
    });
    const updated = createTestAlbum({
      id: 42,
      date_lost: null,
      date_found: "2024-02-01",
    });

    vi.spyOn(catalogApi.util, "selectCachedArgsForQuery").mockReturnValue([
      queryArgs,
    ]);

    vi.spyOn(catalogApi.util, "updateQueryData").mockImplementation(
      (_endpoint, args, updater) => {
        expect(args).toEqual(queryArgs);
        const draft = {
          pages: [
            {
              results: [existing],
              total: 1,
              page: 0,
              totalPages: 1,
            },
            {
              results: [],
              total: 1,
              page: 1,
              totalPages: 1,
            },
          ],
        };
        updater(draft);
        expect(draft.pages[0].results).toHaveLength(0);
        expect(draft.pages[0].total).toBe(0);
        expect(draft.pages[1].total).toBe(0);
        return { type: "catalogApi/updateQueryData" } as never;
      },
    );

    patchCatalogSearchCaches(dispatch, () => ({} as never), updated);

    expect(dispatch).toHaveBeenCalledWith(
      catalogSlice.actions.patchSearchResult(updated),
    );
  });

  it("updates a row in place when it still matches the cached filter", () => {
    const dispatch = vi.fn();
    const queryArgs = { genres: "Rock" };
    const existing = createTestAlbum({
      id: 42,
      artist: {
        name: "Artist",
        lettercode: "AB",
        numbercode: 1,
        genre: "Rock",
        id: 1,
      },
    });
    const updated = createTestAlbum({
      id: 42,
      title: "Updated Title",
      artist: existing.artist,
    });

    vi.spyOn(catalogApi.util, "selectCachedArgsForQuery").mockReturnValue([
      queryArgs,
    ]);

    vi.spyOn(catalogApi.util, "updateQueryData").mockImplementation(
      (_endpoint, _args, updater) => {
        const draft = {
          pages: [
            {
              results: [existing],
              total: 1,
              page: 0,
              totalPages: 1,
            },
          ],
        };
        updater(draft);
        expect(draft.pages[0].results[0].title).toBe("Updated Title");
        expect(draft.pages[0].results).toHaveLength(1);
        return { type: "catalogApi/updateQueryData" } as never;
      },
    );

    patchCatalogSearchCaches(dispatch, () => ({} as never), updated);
  });
});
