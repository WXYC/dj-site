import type { AlbumSearchResult } from "@wxyc/shared/dtos";
import { Rotation } from "../rotation/types";

export type { AlbumSearchResult };

/** Track-level match hints returned by catalog track search (not yet in @wxyc/shared). */
export type TrackMatchHint = {
  source: string;
  title: string;
  confidence?: number;
  position?: string;
  artist_credit?: string;
};

export const TrackMatchSource = {
  cta: "cta",
  discogs_master: "discogs_master",
} as const;

/**
 * JSON boundary adapter for AlbumSearchResult.
 * RTK Query delivers raw JSON where add_date is a string, not a Date.
 *
 * discogsUnavailable/discogsUnavailableNote/lastDiscogsRecheckAt are declared
 * here by hand rather than picked up from `AlbumSearchResult`: api.yaml only
 * carries them on `Album`/`AlbumInfoResponse` (the `GET /library/info`
 * response schema), not on `AlbumSearchResult`, even though `GET /library/`,
 * `GET /library/query`, and `PATCH /library/:id` all serve from the same
 * backend read model and carry the fields on the wire.
 */
export type AlbumSearchResultJSON = Omit<AlbumSearchResult, "add_date"> & {
  add_date: string;
  matched_via?: TrackMatchHint[];
  discogsUnavailable?: boolean;
  discogsUnavailableNote?: string | null;
  lastDiscogsRecheckAt?: string | null;
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
 * PATCH /library/:id is a true partial update on the backend — only fields
 * present in the body are validated and written — so every field here is
 * optional. discogsUnavailableNote must be null whenever discogsUnavailable
 * is false or absent-with-existing-false-state (the backend CHECK constraint
 * `discogs_unavailable OR discogs_unavailable_note IS NULL`); callers that
 * only toggle the flag off must pass `discogsUnavailableNote: null` alongside
 * it rather than omitting the note. lastDiscogsRecheckAt is deliberately
 * absent — it is server-write-only.
 */
export type UpdateAlbumRequestBody = {
  album_title?: string;
  label?: string;
  genre_id?: number;
  format_id?: number;
  artist_id?: number;
  alternate_artist_name?: string;
  disc_quantity?: number;
  label_id?: number;
  discogsUnavailable?: boolean;
  discogsUnavailableNote?: string | null;
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
  date_lost?: string | null;
  date_found?: string | null;
  artwork_url?: string | null;
  matched_via?: TrackMatchHint[];
  /** Present on `/library/info` responses for catalog edit. */
  artist_id?: number;
  genre_id?: number;
  format_id?: number;
  disc_quantity?: number;
  /** MD-set marker: this release is intentionally not on Discogs (embargoed promo, audience-segment release, etc). Writable via PATCH /library/:id. */
  discogsUnavailable?: boolean;
  /** Optional free-text reason for discogsUnavailable; null whenever the flag is false. Writable via PATCH /library/:id. */
  discogsUnavailableNote?: string | null;
  /** Stamped by the daily discogs-unavailable recheck cron. Read-only — never sent in a PATCH body. */
  lastDiscogsRecheckAt?: string | null;
};

export type ArtistEntry = {
  name: string;
  lettercode: string;
  numbercode: number;
  genre: Genre;
  id: number | undefined;
};

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
  genres: string[]; // empty = no genre filter
  formats: string[]; // empty = no format filter
  tags: string[]; // status: exclusives, missing; rotation bins: H, M, L, S
};

export type CatalogSearchState = {
  rows: CatalogSearchRow[];
  sortBy: CatalogSortBy;
  sortOrder: CatalogSortOrder;
  filters: CatalogFilters;
  selected: number[];
  mobileOpen: boolean;
  /** User chose to browse the full catalog (empty query) without typing a search. */
  browseEngaged: boolean;
};

export type LibraryQueryParams = {
  q?: string;
  page?: number;
  limit?: number;
  sort?: CatalogSortBy;
  order?: CatalogSortOrder;
  on_streaming?: boolean;
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

export type SearchIn = "Artists" | "Albums" | "All";

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
