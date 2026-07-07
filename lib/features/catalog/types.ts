import type { AlbumSearchResult, TrackMatchHint } from "@wxyc/shared/dtos";
import { TrackMatchSource } from "@wxyc/shared/dtos";
import { Rotation } from "../rotation/types";

export type { AlbumSearchResult, TrackMatchHint };
export { TrackMatchSource };

/**
 * JSON boundary adapter for AlbumSearchResult.
 * RTK Query delivers raw JSON where add_date is a string, not a Date.
 */
export type AlbumSearchResultJSON = Omit<AlbumSearchResult, "add_date"> & {
  add_date: string;
  matched_via?: TrackMatchHint[];
};

export type SearchCatalogQueryParams = {
  artist_name: string | undefined;
  album_title: string | undefined;
  n: number | undefined;
  on_streaming?: boolean;
};

/**
 * POST /library — matches Backend-Service `NewAlbumRequest` (JSON uses numbers for ids).
 */
export type AddAlbumRequestBody = {
  album_title: string;
  label: string;
  genre_id: number;
  format_id: number;
  artist_name?: string;
  artist_id?: number;
  alternate_artist_name?: string;
  disc_quantity?: number;
  label_id?: number;
};

export type UpdateAlbumRequestBody = {
  album_title: string;
  label: string;
  genre_id: number;
  format_id: number;
  artist_id: number;
  alternate_artist_name?: string;
  disc_quantity?: number;
  label_id?: number;
};

/**
 * POST /library/artists
 */
export type AddArtistRequestBody = {
  artist_name: string;
  code_letters: string;
  genre_id: number;
  code_number: number;
  alphabetical_name?: string;
};

export type PeekArtistCodeQuery = {
  code_letters: string;
  genre_id: number;
};

export type PeekArtistCodeResponse = {
  next_code_number: number;
};

export type ArtistInGenreOption = {
  id: number;
  artist_name: string;
  code_letters: string;
  code_number: number;
};

export type SearchArtistsInGenreParams = {
  genre_id: number;
  q: string;
  limit?: number;
};

export type SearchArtistsInGenreResponse = {
  artists: ArtistInGenreOption[];
};

export type LibraryFormatRow = {
  id: number;
  format_name: string;
  add_date?: string;
};

export type LibraryGenreRow = {
  id: number;
  genre_name: string;
  description?: string | null;
  plays?: number;
  add_date?: string;
  last_modified?: string;
};

export type AddFormatRequestBody = {
  name: string;
};

export type AddGenreRequestBody = {
  name: string;
  description: string;
};

export type AlbumParams = {
  album_title: string;
  artist_name: string | undefined;
  artist_id: string | undefined;
  label: string;
  genre_id: string;
  format_id: string;
  disc_quantity: number | undefined;
  alternate_artist_name: string | undefined;
};

export type AlbumRequestParams = {
  album_id: number;
};

export type ArtistParams = {
  artist_name: string;
  code_letters: string;
  genre_id: string;
};

export type AlbumEntry = {
  id: number;
  title: string;
  artist: ArtistEntry;
  entry: number;
  format: Format;
  alternate_artist: string | undefined;
  album_artist?: string;
  rotation_bin: Rotation | undefined;
  rotation_id: number | undefined;
  plays: number | undefined;
  add_date: string | undefined;
  label: string;
  on_streaming?: boolean;
  date_lost?: string | null;
  date_found?: string | null;
  artwork_url?: string | null;
  matched_via?: TrackMatchHint[];
  /** Present on `/library/info` responses for catalog edit. */
  artist_id?: number;
  genre_id?: number;
  format_id?: number;
  disc_quantity?: number;
};

export type ArtistEntry = {
  name: string;
  lettercode: string;
  numbercode: number;
  genre: Genre;
  id: number | undefined;
};

// --- Query-builder state ---

export type CatalogSearchField = "all" | "artist" | "album" | "label";
export type CatalogSearchOperator = "AND" | "OR" | "NOT";
export type CatalogSortBy = "artist" | "album" | "plays" | "date";
export type CatalogSortOrder = "asc" | "desc";

export type CatalogSearchRow = {
  id: string; // uuid for stable React keys
  operator: CatalogSearchOperator; // first row's operator is hidden by the UI but stored as 'AND'
  field: CatalogSearchField;
  value: string;
  exact: boolean; // mirrored from quoted-value input
};

export type CatalogFilters = {
  onStreaming: boolean | undefined; // undefined = no filter
  genre: Genre | "All"; // 'All' = no filter
  format: Format | "All"; // 'All' = no filter
};

export type CatalogSearchState = {
  rows: CatalogSearchRow[];
  sortBy: CatalogSortBy;
  sortOrder: CatalogSortOrder;
  page: number;
  filters: CatalogFilters;
  selected: number[];
  mobileOpen: boolean;
};

// --- Request envelope for /library/query ---

export type LibraryQueryParams = {
  q?: string;
  page?: number;
  limit?: number;
  sort?: CatalogSortBy;
  order?: CatalogSortOrder;
  on_streaming?: boolean;
  genre?: string;
  format?: string;
  missing?: boolean;
  genres?: string;
  formats?: string;
  /** Comma-separated active rotation bins (H, M, L, S). */
  rotation_bins?: string;
};

export type Format = "Vinyl" | "CD" | "Unknown";

export type Genre =
  | "Blues"
  | "Rock"
  | "Electronic"
  | "Hiphop"
  | "Jazz"
  | "Classical"
  | "Reggae"
  | "Soundtracks"
  | "OCS"
  | "Unknown";

/** Shared rotation UI state for a library album (search row, edit panel, context menu). */
export type CatalogAlbumRotation = {
  rotation_bin: Rotation | undefined;
  rotation_id: number | undefined;
};

/** Open catalog result row context menu (at most one globally). */
export type CatalogResultContextMenuState = {
  albumId: number;
  top: number;
  left: number;
};

export type CatalogFrontendState = CatalogSearchState & {
  /** Latest album saved from catalog edit; drives in-memory search list refresh. */
  lastPatchedSearchResult: AlbumEntry | null;
  /** Per-album rotation after apply or hydrate; ties rightbar and catalog results together. */
  rotationByAlbumId: Record<number, CatalogAlbumRotation>;
  /** Which search result row owns the open context menu, if any. */
  resultContextMenu: CatalogResultContextMenuState | null;
};
