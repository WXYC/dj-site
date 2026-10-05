import type { AlbumEntry } from "@/lib/features/catalog/types";
import type { LmlLibraryItem } from "./types";

/**
 * Converts an LML library search result to the frontend `AlbumEntry` type.
 * LML does not carry rotation or play count data — those fields are left
 * undefined and filled in once the DJ selects the entry. `label`,
 * `on_streaming`, and `matched_via` DO ride on the response (dj-site#605); a
 * missing/null `on_streaming` stays `undefined` so it is not mistaken for the
 * `false` value that renders the WXYC EXCLUSIVE chip.
 *
 * The call number is LML's, not ours: `call_number` is carried verbatim and
 * rendered as served, so LML stays the only composer of a string it already
 * composes (section letters, compilation buckets, partial rows included). The
 * parts below are the fallback for an LML that predates the field. A null
 * artist number stays null rather than becoming a fabricated `0`; the release
 * number keeps its `?? 0` because `AlbumEntry.entry` is a required number
 * across every catalog surface, and LML never files a release without one.
 */
export function convertLmlItemToAlbumEntry(item: LmlLibraryItem): AlbumEntry {
  return {
    id: item.id,
    // LML's `library.db` is keyed by the tubafrenzy LIBRARY_RELEASE_ID, so the
    // `id` it returns is a legacy release id, not a Backend `library.id`. It
    // belongs in this field; `id` keeps the same value for now, which makes an
    // LML row the one source where the two spaces legitimately coincide.
    legacy_release_id: item.id,
    // The marker the freeze path's interim album_id write-gate keys on; see
    // AlbumEntry.lml_source for the removal condition.
    lml_source: true,
    call_number: item.call_number,
    title: item.title ?? "",
    artist: {
      name: item.artist ?? "",
      lettercode: item.call_letters ?? "",
      numbercode: item.artist_call_number,
      // Verbatim; the sentinel is for a row with no genre. See `ArtistEntry.genre`.
      genre: item.genre ?? "Unknown",
      // LML answers out of its own `library.db`, which carries a genre NAME
      // and no Backend `genres.id` — so an LML-sourced row cannot scope an
      // artist card, and says so rather than guessing one from the name.
      genre_id: undefined,
      id: undefined,
    },
    entry: item.release_call_number ?? 0,
    // Verbatim; the sentinel is for a row with no format. See `AlbumEntry.format`.
    format: item.format ?? "Unknown",
    alternate_artist: item.alternate_artist_name ?? "",
    label: item.label ?? "",
    on_streaming: item.on_streaming ?? undefined,
    matched_via: item.matched_via,
    rotation_bin: undefined,
    rotation_id: undefined,
    plays: undefined,
    add_date: undefined,
  };
}
