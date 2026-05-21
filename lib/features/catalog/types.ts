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

export type AlbumRequestParams = {
  album_id: number;
};

/** @deprecated use AddAlbumRequestBody */
export type AlbumParams = AddAlbumRequestBody;

/** @deprecated use AddArtistRequestBody */
export type ArtistParams = AddArtistRequestBody;

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
  date_lost?: string;
  date_found?: string;
  artwork_url?: string | null;
  matched_via?: TrackMatchHint[];
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

/** Legacy single-string search for admin catalog (isolated from query builder). */
export type LegacyCatalogSearchState = {
  query: string;
  in: SearchIn;
  genre: Genre | "All";
  exclusive: boolean;
  mobileOpen: boolean;
  params: {
    n: number;
    orderBy?: string;
    orderDirection?: "asc" | "desc";
  };
};

export type CatalogResultsState = {
  selected: number[];
};

export type SearchIn = "Artists" | "Albums" | "All";

/** Keys tracked for "Create artist" (Redux, same pattern as login `authenticationSlice`). */
export type AdminCreateArtistFieldKey =
  | "codeLetters"
  | "codeNumber"
  | "newArtistName"
  | "genreSelected";

export type AdminCreateArtistVerifications = Record<
  AdminCreateArtistFieldKey,
  boolean
>;

export type AdminCreateArtistFormState = {
  verifications: AdminCreateArtistVerifications;
  required: AdminCreateArtistFieldKey[];
};

/** Isolated search/results for `/dashboard/admin/catalog` (does not clobber Card Catalog). */
export type AdminCatalogUIState = {
  search: LegacyCatalogSearchState;
  results: CatalogResultsState;
};

export type CatalogFrontendState = CatalogSearchState & {
  adminCatalog: AdminCatalogUIState;
  adminCreateArtist: AdminCreateArtistFormState;
};
