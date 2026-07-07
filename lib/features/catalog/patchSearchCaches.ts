import type { AppDispatch, RootState } from "@/lib/store";
import type { Rotation } from "@/lib/features/rotation/types";
import {
  albumMatchesCatalogQueryArg,
  type CatalogSearchQueryCacheArg,
} from "./catalogSearchQueryMatch";
import { catalogSlice } from "./frontend";
import { catalogApi, type LibraryQueryResult } from "./api";
import type { AlbumEntry, CatalogSortBy, CatalogSortOrder } from "./types";
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

function setInfiniteDraftTotal(
  draft: { pages: LibraryQueryResult[] },
  total: number,
): void {
  for (const page of draft.pages) {
    page.total = total;
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
    setInfiniteDraftTotal(
      draft,
      Math.max(0, draft.pages[0].total - 1),
    );
  }
  return removed;
}

function sortKeyForAlbum(
  album: AlbumEntry,
  sortBy: CatalogSortBy,
): string | number {
  switch (sortBy) {
    case "artist":
      return album.artist.name.toLowerCase();
    case "plays":
      return album.plays ?? 0;
    case "date":
      return album.add_date ?? "";
    case "album":
    default:
      return album.title.toLowerCase();
  }
}

function compareAlbumsForSort(
  a: AlbumEntry,
  b: AlbumEntry,
  sortBy: CatalogSortBy,
  order: CatalogSortOrder,
): number {
  const aKey = sortKeyForAlbum(a, sortBy);
  const bKey = sortKeyForAlbum(b, sortBy);
  const cmp =
    typeof aKey === "number" && typeof bKey === "number"
      ? aKey - bKey
      : String(aKey).localeCompare(String(bKey));
  return order === "desc" ? -cmp : cmp;
}

function insertAlbumIntoInfiniteDraft(
  draft: { pages: LibraryQueryResult[] },
  album: AlbumEntry,
  args: CatalogSearchQueryCacheArg,
): void {
  if (findAlbumInSearchDraft(draft, album.id)) return;

  if (!draft.pages.length) {
    draft.pages = [
      { results: [album], total: 1, page: 0, totalPages: 1 },
    ];
    return;
  }

  const page = draft.pages[0];
  const sortBy = args.sort ?? "album";
  const order = args.order ?? "asc";
  let insertAt = page.results.length;
  for (let i = 0; i < page.results.length; i++) {
    if (compareAlbumsForSort(album, page.results[i], sortBy, order) < 0) {
      insertAt = i;
      break;
    }
  }
  page.results.splice(insertAt, 0, album);
  setInfiniteDraftTotal(draft, page.total + 1);
}

function hasUsableAlbumData(album: AlbumEntry): boolean {
  return Boolean(album.title.trim() || album.artist.name.trim());
}

function resolveAlbumEntryForRotationPatch(
  getState: () => RootState,
  albumId: number,
  rotation: CatalogSearchRotationPatch,
  albumHint?: AlbumEntry,
): AlbumEntry | null {
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
    "searchLibraryQueryInfinite",
  );
  for (const args of cachedArgs) {
    const data = catalogApi.endpoints.searchLibraryQueryInfinite.select(args)(
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

  return null;
}

function applyRotationToSearchCache(
  draft: { pages: LibraryQueryResult[] },
  args: CatalogSearchQueryCacheArg,
  album: AlbumEntry,
): void {
  const existing = findAlbumInSearchDraft(draft, album.id);
  const matches = albumMatchesCatalogQueryArg(album, args);

  if (existing) {
    existing.rotation_bin = album.rotation_bin;
    existing.rotation_id = album.rotation_id;
    if (!matches) {
      removeAlbumFromInfiniteDraft(draft, album.id);
    }
    return;
  }

  if (matches && !args.q?.trim() && hasUsableAlbumData(album)) {
    insertAlbumIntoInfiniteDraft(draft, album, args);
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
    "searchLibraryQueryInfinite",
  );

  for (const args of cachedArgs) {
    dispatch(
      catalogApi.util.updateQueryData(
        "searchLibraryQueryInfinite",
        args,
        (draft) => {
          if (!album) {
            const existing = findAlbumInSearchDraft(draft, albumId);
            if (existing) {
              existing.rotation_bin = rotation.rotation_bin;
              existing.rotation_id = rotation.rotation_id;
            }
            return;
          }
          applyRotationToSearchCache(draft, args, album);
        },
      ),
    );
  }

  if (album) {
    dispatch(catalogSlice.actions.patchSearchResult(album));
  }
}

/** Patch every cached `/library/query` page that contains this album id. */
export function patchCatalogSearchCaches(
  dispatch: AppDispatch,
  getState: () => RootState,
  updated: AlbumEntry,
): void {
  const cachedArgs = catalogApi.util.selectCachedArgsForQuery(
    getState(),
    "searchLibraryQueryInfinite",
  );

  for (const args of cachedArgs) {
    dispatch(
      catalogApi.util.updateQueryData(
        "searchLibraryQueryInfinite",
        args,
        (draft) => {
          const existing = findAlbumInSearchDraft(draft, updated.id);
          if (!existing) return;

          const merged = mergeAlbumIntoSearchResult(existing, updated);
          if (!albumMatchesCatalogQueryArg(merged, args)) {
            removeAlbumFromInfiniteDraft(draft, updated.id);
            return;
          }

          Object.assign(existing, merged);
        },
      ),
    );
  }

  dispatch(catalogSlice.actions.patchSearchResult(updated));
}
