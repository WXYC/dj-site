import type { AppDispatch, RootState } from "@/lib/store";
import type { Rotation } from "@/lib/features/rotation/types";
import { catalogSlice } from "./frontend";
import { catalogApi, type LibraryQueryResult } from "./api";
import type { AlbumEntry } from "./types";
import { mergeAlbumIntoSearchResult } from "./patchSearchResult";

export type CatalogSearchRotationPatch = {
  rotation_bin: Rotation | undefined;
  rotation_id: number | undefined;
};

function patchInfiniteSearchDraft(
  draft: { pages: LibraryQueryResult[] },
  patchRow: (row: AlbumEntry) => void,
) {
  for (const page of draft.pages) {
    for (const row of page.results) {
      patchRow(row);
    }
  }
}

/** Patch rotation fields on every cached search row for this album id. */
export function patchCatalogSearchRotation(
  dispatch: AppDispatch,
  getState: () => RootState,
  albumId: number,
  rotation: CatalogSearchRotationPatch,
): void {
  dispatch(
    catalogSlice.actions.setAlbumRotation({
      albumId,
      rotation_bin: rotation.rotation_bin,
      rotation_id: rotation.rotation_id,
    }),
  );

  const cachedArgs = catalogApi.util.selectCachedArgsForQuery(
    getState(),
    "searchLibraryQuery",
  );

  for (const args of cachedArgs) {
    dispatch(
      catalogApi.util.updateQueryData(
        "searchLibraryQuery",
        args,
        (draft) => {
          patchInfiniteSearchDraft(draft, (row) => {
            if (row.id !== albumId) return;
            row.rotation_bin = rotation.rotation_bin;
            row.rotation_id = rotation.rotation_id;
          });
        },
      ),
    );
  }

  const partial: AlbumEntry = {
    id: albumId,
    title: "",
    artist: { name: "", lettercode: "", numbercode: 0, genre: "Unknown" },
    entry: 0,
    format: "Unknown",
    alternate_artist: "",
    label: "",
    rotation_bin: rotation.rotation_bin,
    rotation_id: rotation.rotation_id,
  };
  dispatch(catalogSlice.actions.patchSearchResult(partial));
}

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
      catalogApi.util.updateQueryData(
        "searchLibraryQuery",
        args,
        (draft) => {
          patchInfiniteSearchDraft(draft, (row) => {
            if (row.id !== updated.id) return;
            Object.assign(row, mergeAlbumIntoSearchResult(row, updated));
          });
        },
      ),
    );
  }

  dispatch(catalogSlice.actions.patchSearchResult(updated));
}
