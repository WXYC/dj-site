import type { AlbumEntry } from "../catalog/types";

/**
 * Sort rotation releases alphabetically by artist (case-insensitive), ties
 * broken by album title. Used by both Modern and Classic rotation pickers
 * so a release lands in the same neighborhood regardless of which UI the
 * DJ is using. WXYC/dj-site#745.
 *
 * `localeCompare` handles unicode (e.g. "Á", "ß", "É") more naturally than
 * naive `<` on strings; `sensitivity: "base"` collapses diacritics so
 * "Émilie" sorts alongside "Emilie".
 */
export function sortRotationReleases(releases: AlbumEntry[]): AlbumEntry[] {
  return [...releases].sort((a, b) => {
    // `artist` can be absent on library-unlinked rotation rows; coalesce to ""
    // so the comparator never dereferences null (same guard class as the
    // RotationReleaseDropdown / RotationEntryFields fixes).
    const artistCmp = (a.artist?.name ?? "").localeCompare(
      b.artist?.name ?? "",
      undefined,
      { sensitivity: "base" }
    );
    if (artistCmp !== 0) return artistCmp;
    return a.title.localeCompare(b.title, undefined, { sensitivity: "base" });
  });
}
