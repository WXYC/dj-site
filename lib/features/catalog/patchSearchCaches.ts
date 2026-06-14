import type { AppDispatch, RootState } from "@/lib/store";
import type { Rotation } from "@/lib/features/rotation/types";
import {
  albumMatchesCatalogQueryArg,
  type CatalogSearchQueryCacheArg,
} from "./catalogSearchQueryMatch";
import { catalogSlice } from "./frontend";
import { catalogApi, type LibraryQueryResult } from "./api";
import type { AlbumEntry } from "./types";
import { mergeAlbumIntoSearchResult } from "./patchSearchResult";

export type CatalogSearchRotationPatch = {
  rotation_bin: Rotation | undefined;
  rotation_id: number | undefined;
};

function findAlbumInSearchDraft(
  draft: { pages: LibraryQueryResult[] },
  albumId: number,
): AlbumEntry | undefined {
  for (const page of draft.pages) {
    const row = page.results.find((r) => r.id === albumId);
    if (row) return row;
  }
  return undefined;
}

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

function removeAlbumFromInfiniteDraft(
  draft: { pages: LibraryQueryResult[] },
  albumId: number,
): boolean {
  let removed = false;
  for (const page of draft.pages) {
    const index = page.results.findIndex((r) => r.id === albumId);
    if (index === -1) continue;
    page.results.splice(index, 1);
    removed = true;
  }
  if (removed && draft.pages[0]) {
    draft.pages[0].total = Math.max(0, draft.pages[0].total - 1);
  }
  return removed;
}

function insertAlbumIntoInfiniteDraft(
  draft: { pages: LibraryQueryResult[] },
  album: AlbumEntry,
): void {
  if (findAlbumInSearchDraft(draft, album.id)) return;

  if (!draft.pages.length) {
    draft.pages = [
      { results: [album], total: 1, page: 0, totalPages: 1 },
    ];
    return;
  }

  draft.pages[0].results.unshift(album);
  draft.pages[0].total += 1;
}

function resolveAlbumEntryForRotationPatch(
  getState: () => RootState,
  albumId: number,
  rotation: CatalogSearchRotationPatch,
  albumHint?: AlbumEntry,
): AlbumEntry {
  if (albumHint) {
    return {
      ...albumHint,
      rotation_bin: rotation.rotation_bin,
      rotation_id: rotation.rotation_id,
    };
  }

  const info = catalogApi.endpoints.getInformation.select({
    album_id: albumId,
  })(getState())?.data;
  if (info) {
    return {
      ...info,
      rotation_bin: rotation.rotation_bin,
      rotation_id: rotation.rotation_id,
    };
  }

  const cachedArgs = catalogApi.util.selectCachedArgsForQuery(
    getState(),
    "searchLibraryQuery",
  );
  for (const args of cachedArgs) {
    const data = catalogApi.endpoints.searchLibraryQuery.select(args)(
      getState(),
    )?.data;
    if (!data?.pages) continue;
    const existing = findAlbumInSearchDraft(data, albumId);
    if (existing) {
      return {
        ...existing,
        rotation_bin: rotation.rotation_bin,
        rotation_id: rotation.rotation_id,
      };
    }
  }

  return {
    id: albumId,
    title: "",
    artist: {
      name: "",
      lettercode: "",
      numbercode: 0,
      genre: "Unknown",
      id: undefined,
    },
    entry: 0,
    format: "Unknown",
    alternate_artist: "",
    label: "",
    plays: undefined,
    add_date: undefined,
    rotation_bin: rotation.rotation_bin,
    rotation_id: rotation.rotation_id,
  };
}

function applyRotationToSearchCache(
  draft: { pages: LibraryQueryResult[] },
  args: CatalogSearchQueryCacheArg,
  album: AlbumEntry,
): void {
  const existing = findAlbumInSearchDraft(draft, album.id);
  const matches = albumMatchesCatalogQueryArg(album, args);

  if (matches) {
    if (existing) {
      existing.rotation_bin = album.rotation_bin;
      existing.rotation_id = album.rotation_id;
    } else {
      insertAlbumIntoInfiniteDraft(draft, album);
    }
    return;
  }

  if (existing) {
    removeAlbumFromInfiniteDraft(draft, album.id);
  }
}

/**
 * Patch rotation on cached catalog search pages and sync Redux rotation state.
 * Inserts or removes rows when the active cached query filters by rotation bin.
 */
export function patchCatalogSearchRotation(
  dispatch: AppDispatch,
  getState: () => RootState,
  albumId: number,
  rotation: CatalogSearchRotationPatch,
  albumHint?: AlbumEntry,
): void {
  dispatch(
    catalogSlice.actions.setAlbumRotation({
      albumId,
      rotation_bin: rotation.rotation_bin,
      rotation_id: rotation.rotation_id,
    }),
  );

  const album = resolveAlbumEntryForRotationPatch(
    getState,
    albumId,
    rotation,
    albumHint,
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
          applyRotationToSearchCache(draft, args, album);
        },
      ),
    );
  }

  dispatch(catalogSlice.actions.patchSearchResult(album));
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
