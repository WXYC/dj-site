import { foldForSearch } from "@/lib/features/admin/roster-filter";
import type { AlbumEntry } from "@/lib/features/catalog/types";

const key = (value: string) => foldForSearch(value.trim());

/**
 * The library release whose artist and title equal the record's, trimmed and without regard to case or accents.
 * The catalog search answers fuzzy extras too, and a row with no Backend library id (an LML-only row, whose `id` is a legacy id) cannot be cited, so neither counts.
 */
export function matchLibraryRelease(rows: AlbumEntry[], artist: string, album: string): AlbumEntry | undefined {
  const [wantArtist, wantAlbum] = [key(artist), key(album)];
  return rows.find((r) => r.id !== null && !r.lml_source && key(r.artist.name) === wantArtist && key(r.title) === wantAlbum);
}
