import type { AlbumEntry, Format, Genre } from "@/lib/features/catalog/types";
import type { LmlLibraryItem } from "./types";

const VALID_GENRES: ReadonlySet<string> = new Set<Genre>([
  "Blues",
  "Rock",
  "Electronic",
  "Hiphop",
  "Jazz",
  "Classical",
  "Reggae",
  "Soundtracks",
  "OCS",
  "Unknown",
]);

function normalizeFormat(format: string | null): Format {
  if (!format) return "Unknown";
  const lower = format.toLowerCase();
  if (lower.includes("vinyl")) return "Vinyl";
  if (lower.includes("cd")) return "CD";
  return "Unknown";
}

function normalizeGenre(genre: string | null): Genre {
  if (genre && VALID_GENRES.has(genre)) return genre as Genre;
  return "Unknown";
}

/**
 * Converts an LML library search result to the frontend `AlbumEntry` type.
 * LML does not carry label, rotation, or play count data — those fields are
 * left empty/undefined and filled in once the DJ selects the entry.
 */
export function convertLmlItemToAlbumEntry(item: LmlLibraryItem): AlbumEntry {
  return {
    id: item.id,
    title: item.title ?? "",
    artist: {
      name: item.artist ?? "",
      lettercode: item.call_letters ?? "",
      numbercode: item.artist_call_number ?? 0,
      genre: normalizeGenre(item.genre),
      id: undefined,
    },
    entry: item.release_call_number ?? 0,
    format: normalizeFormat(item.format),
    alternate_artist: item.alternate_artist_name ?? "",
    label: "",
    rotation_bin: undefined,
    rotation_id: undefined,
    plays: undefined,
    add_date: undefined,
  };
}
