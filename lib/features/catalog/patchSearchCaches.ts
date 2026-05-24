import type { AppDispatch, RootState } from "@/lib/store";
import { catalogSlice } from "./frontend";
import { catalogApi } from "./api";
import type { AlbumEntry } from "./types";
import { mergeAlbumIntoSearchResult } from "./patchSearchResult";

/** Patch every cached `/library/query` page that contains this album id. */
export function patchCatalogSearchCaches(
  dispatch: AppDispatch,
  getState: () => RootState,
  updated: AlbumEntry,
): void {
  const cachedArgs = catalogApi.util.selectCachedArgsForQuery(
    getState(),
    "searchLibraryQuery",
  );

  for (const args of cachedArgs) {
    dispatch(
      catalogApi.util.updateQueryData("searchLibraryQuery", args, (draft) => {
        const index = draft.results.findIndex((row) => row.id === updated.id);
        if (index === -1) return;
        draft.results[index] = mergeAlbumIntoSearchResult(
          draft.results[index],
          updated,
        );
      }),
    );
  }

  dispatch(catalogSlice.actions.patchSearchResult(updated));
}
