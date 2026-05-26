import type { AlbumEntry } from "./types";

export type ParsedLibraryCode = {
  genreSlug: string;
  codeLetters: string;
  artistNumber: number;
  albumEntry: number;
};

export function genreNameToSlug(genreName: string): string {
  return genreName.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function formatLibraryCode(parts: {
  genreName: string;
  codeLetters: string;
  artistNumber: number;
  albumEntry: number;
}): string {
  const letters = parts.codeLetters.trim().toUpperCase();
  return `${genreNameToSlug(parts.genreName)}-${letters}-${parts.artistNumber}-${parts.albumEntry}`;
}

const LIBRARY_CODE_PATTERN = /^([a-z0-9]+)-([A-Za-z]{1,4})-(\d+)-(\d+)$/;

export function parseLibraryCodeParam(code: string): ParsedLibraryCode | null {
  const trimmed = code.trim();
  if (!trimmed || /^\d+$/.test(trimmed)) {
    return null;
  }
  const match = trimmed.match(LIBRARY_CODE_PATTERN);
  if (!match) {
    return null;
  }
  const artistNumber = Number(match[3]);
  const albumEntry = Number(match[4]);
  if (!Number.isInteger(artistNumber) || artistNumber < 0) {
    return null;
  }
  if (!Number.isInteger(albumEntry) || albumEntry < 0) {
    return null;
  }
  return {
    genreSlug: match[1].toLowerCase(),
    codeLetters: match[2].toUpperCase(),
    artistNumber,
    albumEntry,
  };
}

export function isNumericAlbumId(id: string): boolean {
  return /^\d+$/.test(id.trim());
}

/** Build permalink segment for an album row, or null when code cannot be encoded. */
export function encodeLibraryCode(album: AlbumEntry): string | null {
  const genre = album.artist.genre?.trim();
  const letters = album.artist.lettercode?.trim();
  if (!genre || !letters) {
    return null;
  }
  const artistNumber = album.artist.numbercode;
  const albumEntry = album.entry;
  if (
    typeof artistNumber !== "number" ||
    !Number.isFinite(artistNumber) ||
    typeof albumEntry !== "number" ||
    !Number.isFinite(albumEntry)
  ) {
    return null;
  }
  return formatLibraryCode({
    genreName: genre,
    codeLetters: letters,
    artistNumber,
    albumEntry,
  });
}

export function albumPermalinkSegment(album: AlbumEntry): string {
  const code = encodeLibraryCode(album);
  if (code) {
    return code;
  }
  if (album.id > 0) {
    return String(album.id);
  }
  return String(album.id);
}

export function catalogAlbumPath(albumOrSegment: AlbumEntry | string | number): string {
  const segment =
    typeof albumOrSegment === "number"
      ? String(albumOrSegment)
      : typeof albumOrSegment === "string"
        ? albumOrSegment
        : albumPermalinkSegment(albumOrSegment);
  return `/dashboard/catalog/album/${encodeURIComponent(segment)}`;
}

export function catalogAlbumEditPath(albumOrSegment: AlbumEntry | string | number): string {
  return `${catalogAlbumPath(albumOrSegment)}/edit`;
}

export const CATALOG_ADD_PATH = "/dashboard/catalog/new";

const CATALOG_ALBUM_VIEW_RE =
  /^\/dashboard\/catalog\/album\/([^/]+)$/;
const CATALOG_ALBUM_EDIT_RE =
  /^\/dashboard\/catalog\/album\/([^/]+)\/edit$/;

export function parseCatalogAlbumIdFromPathname(pathname: string): string | null {
  const editMatch = pathname.match(CATALOG_ALBUM_EDIT_RE);
  if (editMatch) {
    return decodeURIComponent(editMatch[1]);
  }
  const viewMatch = pathname.match(CATALOG_ALBUM_VIEW_RE);
  if (viewMatch) {
    return decodeURIComponent(viewMatch[1]);
  }
  return null;
}

export function isCatalogAlbumViewPath(pathname: string): boolean {
  return CATALOG_ALBUM_VIEW_RE.test(pathname);
}

export function isCatalogAlbumEditPath(pathname: string): boolean {
  return CATALOG_ALBUM_EDIT_RE.test(pathname);
}

export function isCatalogAddPath(pathname: string): boolean {
  return pathname === CATALOG_ADD_PATH;
}

export function isCatalogModalPath(pathname: string): boolean {
  return (
    isCatalogAddPath(pathname) ||
    isCatalogAlbumViewPath(pathname) ||
    isCatalogAlbumEditPath(pathname)
  );
}

export type AlbumInfoRequest =
  | { album_id: number }
  | { library_code: string };

export function albumInfoRequestFromRouteId(id: string): AlbumInfoRequest {
  if (isNumericAlbumId(id)) {
    return { album_id: Number(id) };
  }
  return { library_code: decodeURIComponent(id) };
}
