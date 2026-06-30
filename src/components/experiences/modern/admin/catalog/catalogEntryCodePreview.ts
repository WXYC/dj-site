import type { AlbumEntry } from "@/lib/features/catalog/types";
import type { AdminCatalogCodePreviewProps } from "./AdminCatalogCodePreview";

/** Static library code preview from a loaded catalog entry (album detail view). */
export function albumEntryToCodePreview(
  album: AlbumEntry,
  rotation?: string | null,
): AdminCatalogCodePreviewProps {
  return {
    genreName: album.artist.genre ?? null,
    codeLetters: album.artist.lettercode ?? "",
    artistNumber: album.artist.numbercode ?? null,
    albumEntry: album.entry ?? "?",
    formatLabel: album.format ?? null,
    rotation: rotation ?? album.rotation_bin ?? null,
  };
}
