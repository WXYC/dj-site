import type { AlbumSearchResult } from "@wxyc/shared/dtos";
import { Rotation } from "../rotation/types";

export type { AlbumSearchResult };

/**
 * Track-level match hints returned by catalog track search.
 *
 * Declared here rather than imported from `@wxyc/shared`, which publishes the
 * same shape with every optional field nullable and `source` narrowed to an
 * enum. Adopting the published shape is a null-handling change at every
 * consumer, not a rename, so the two are kept separate deliberately.
 */
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
 * `matched_via` is omitted from the base and re-declared so the local
 * `TrackMatchHint` applies: intersecting the two array types instead would
 * demand a value satisfying both, which no single response row can.
 */
export type AlbumSearchResultJSON = Omit<
  AlbumSearchResult,
  "add_date" | "matched_via"
> & {
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

/**
 * PATCH /library/:id is a true partial update on the backend — only fields
 * present in the body are validated and written — so every field here is
 * optional. discogsUnavailableNote must be null whenever discogsUnavailable
 * is false or absent-with-existing-false-state (the backend CHECK constraint
 * `discogs_unavailable OR discogs_unavailable_note IS NULL`); callers that
 * only toggle the flag off must pass `discogsUnavailableNote: null` alongside
 * it rather than omitting the note. lastDiscogsRecheckAt is deliberately
 * absent — it is server-write-only. label_id and alternate_artist_name are
 * nullable (matching the published contract) so a caller can explicitly clear
 * either — omitting them is a no-op under true-partial-update semantics, so
 * omission can never clear a value.
 */
export type UpdateAlbumRequestBody = {
  album_title?: string;
  label?: string;
  genre_id?: number;
  format_id?: number;
  artist_id?: number;
  alternate_artist_name?: string | null;
  disc_quantity?: number;
  label_id?: number | null;
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

/**
 * Body of a 409 `POST /library/artists` returns, as the caller sees it: the
 * conflicting artist, so it can be named rather than reported as a generic
 * failure. Two distinct conflicts share this shape. The pre-existing
 * (code_letters, genre_id, code_number) triple conflict sets no `reason` at
 * all — the shape today's deployed backend sends on its one 409. The
 * genre-scoped artist-name conflict sets `reason: "artist_name_conflict"`.
 * The backend also sends a generic `message` alongside `artist`; `addArtist`
 * strips that before the rejection reaches any consumer, so nothing here
 * should read it.
 */
export type AddArtistConflict = {
  artist: { artist_id: number; artist_name: string; code_letters: string };
  reason?: "artist_name_conflict";
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

/**
 * A per-track artist credit to write to a Various-Artists compilation. Only the
 * librarian-meaningful free-text fields travel on the wire: the backend derives
 * the canonical artist link from them server-side, so widening its storage does
 * not widen this shape.
 *
 * `track_title` and `track_position` are both nullable in storage. Position is
 * a string, not a number — sleeve positions are `A1`, `B2`, `1-04`.
 */
export type CompilationTrackInput = {
  artist_name: string;
  track_title?: string | null;
  track_position?: string | null;
};

/** A stored per-track credit, with the id the server assigned it. */
export type CompilationTrack = CompilationTrackInput & {
  id: number;
};

export type CompilationTrackList = {
  library_id: number;
  tracks: CompilationTrack[];
};

/**
 * Result of an additive write. `inserted + skipped` equals the number of rows
 * submitted: a row already present is skipped rather than duplicated, matched
 * on the storage uniqueness key. There is no count of rows changed, because the
 * write path cannot change or remove a row — only add one.
 */
export type CompilationTracksWriteResponse = {
  library_id: number;
  inserted: number;
  skipped: number;
  tracks: CompilationTrack[];
};

/**
 * A proposed — and deliberately unwritten — tracklist derived from the release's
 * linked Discogs entry. `discogs_release_id: null` with an empty `tracks` is the
 * upstream's honest "nothing resolved", which routes the librarian to manual
 * entry. It is not the same as the request having failed; see the endpoint's
 * opt-out of the shared non-JSON soft-fail.
 */
export type CompilationTrackSuggestions = {
  library_id: number;
  discogs_release_id: number | null;
  tracks: CompilationTrackInput[];
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
  id: number | null;
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
