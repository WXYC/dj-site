import type { AlbumEntry, Format } from "@/lib/features/catalog/types";
import type { LmlLibraryItem } from "./types";

function normalizeFormat(format: string | null): Format {
  if (!format) return "Unknown";
  const lower = format.toLowerCase();
  if (lower.includes("vinyl")) return "Vinyl";
  if (lower.includes("cd")) return "CD";
  return "Unknown";
}

/**
 * Converts an LML library search result to the frontend `AlbumEntry` type.
 * LML does not carry rotation or play count data — those fields are left
 * undefined and filled in once the DJ selects the entry. `label`,
 * `on_streaming`, and `matched_via` DO ride on the response (dj-site#605); a
 * missing/null `on_streaming` stays `undefined` so it is not mistaken for the
 * `false` value that renders the WXYC EXCLUSIVE chip.
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
    title: item.title ?? "",
    artist: {
      name: item.artist ?? "",
      lettercode: item.call_letters ?? "",
      numbercode: item.artist_call_number ?? 0,
      // Verbatim; the sentinel is for a row with no genre. See `ArtistEntry.genre`.
      genre: item.genre ?? "Unknown",
      id: undefined,
    },
    entry: item.release_call_number ?? 0,
    format: normalizeFormat(item.format),
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
