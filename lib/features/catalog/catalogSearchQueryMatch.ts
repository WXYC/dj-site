import type { AlbumEntry, LibraryQueryParams } from "./types";

export type CatalogSearchQueryCacheArg = Omit<
  LibraryQueryParams,
  "page" | "limit"
>;
import type { Rotation } from "../rotation/types";

const ROTATION_BIN_PATTERN = /^[HMLS]$/;

/** Parse `rotation_bins` from a cached `/library/query` arg. */
export function parseRotationBinsFromQueryArg(
  rotation_bins?: string,
): Rotation[] | undefined {
  if (!rotation_bins?.trim()) return undefined;
  const bins = rotation_bins
    .split(",")
    .map((part) => part.trim())
    .filter((part): part is Rotation => ROTATION_BIN_PATTERN.test(part));
  return bins.length > 0 ? bins : undefined;
}

/** Whether a row still belongs in results for this cached query arg. */
export function albumMatchesCatalogQueryArg(
  album: AlbumEntry,
  args: CatalogSearchQueryCacheArg,
): boolean {
  const rotationBins = parseRotationBinsFromQueryArg(args.rotation_bins);
  if (rotationBins?.length) {
    if (!album.rotation_bin || !rotationBins.includes(album.rotation_bin)) {
      return false;
    }
  }
  if (args.on_streaming === false && album.on_streaming !== false) {
    return false;
  }
  if (args.missing === true) {
    if (!album.date_lost) return false;
    if (
      album.date_found &&
      album.date_found >= album.date_lost
    ) {
      return false;
    }
  }
  if (args.genres?.trim()) {
    const allowed = args.genres.split(",").map((g) => g.trim());
    if (!allowed.includes(album.artist.genre)) return false;
  }
  if (args.formats?.trim()) {
    const allowed = args.formats.split(",").map((f) => f.trim());
    if (!allowed.includes(album.format)) return false;
  }
  return true;
}
