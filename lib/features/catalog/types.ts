import type {
  AlbumSearchResult,
  ArtistSearchMatch,
  ArtistSearchResponse,
  RotationCard,
} from "@wxyc/shared/dtos";
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
 *
 * `legacy_release_id` is widened to allow `null`. This type carries rotation
 * rows as well as catalog search rows, and the published contract types the
 * two differently — `AlbumSearchResult` non-null (catalog search inner-joins
 * library) but `Rotation` nullable (`getRotationFromDB` LEFT JOINs, and most
 * production rotation rows have no library row behind them). The union of the
 * shapes this type actually carries is the nullable one.
 */
export type AlbumSearchResultJSON = Omit<
  AlbumSearchResult,
  "add_date" | "matched_via" | "legacy_release_id"
> & {
  add_date: string;
  matched_via?: TrackMatchHint[];
  legacy_release_id?: number | null;
  /**
   * The release's definitive (music-director) links, release-scoped. Hand-added
   * because the published `AlbumSearchResult` (`@wxyc/shared@5.4.0`) predates
   * the catalog read-projection change that emits it; delete this arm once the
   * generated type carries `urls`. Plain strings, not `format: uri` — MDs paste
   * bare domains, so a value carries no scheme guarantee and a renderer must
   * sanitise before binding one into an href.
   */
  urls?: string[];
};

export type SearchCatalogQueryParams = {
  artist_name: string | undefined;
  album_title: string | undefined;
  n: number | undefined;
  on_streaming?: boolean;
};

/**
 * POST /library — matches Backend-Service `NewAlbumRequest` (JSON uses numbers for ids).
 *
 * `label` and `label_id` satisfy the label requirement interchangeably: with
 * an id the server re-fetches `labels.label_name` for the denormalized column
 * and skips creating a label, so a caller holding an id must not also invent
 * text for it. One of the two is required and neither is individually, which a
 * type cannot express — send exactly one.
 *
 * `label_id` is deliberately not nullable here, unlike on the PATCH: Backend's
 * create path reads a null as *absent*, so a caller sending
 * `label_id: selected?.id ?? null` would be stating a value it does not have.
 * Omit the key instead.
 *
 * `code_number` and `code_volume_letters` are the operator-chosen call code.
 * Omitting `code_number` keeps the server's own MAX+1 assignment; omitting the
 * letters stores NULL. `code_number` is validated 1..32767 server-side because
 * the column is a `smallint`, and there is deliberately no collision check on
 * either side — re-using a lost record's slot is a move a librarian makes.
 */
export type AddAlbumRequestBody = {
  album_title: string;
  label?: string;
  genre_id: number;
  format_id: number;
  artist_name?: string;
  artist_id?: number;
  alternate_artist_name?: string;
  disc_quantity?: number;
  label_id?: number;
  code_number?: number;
  code_volume_letters?: string;
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
  // The PATCH half of `AddAlbumRequestBody`'s `code_number` /
  // `code_volume_letters`, reusing the same 1..32767 / varchar(4) validators.
  // No artist-scoped collision check on this endpoint, same as `POST
  // /library` -- a single-librarian decision, not an oversight -- so an
  // operator-chosen number that another release already holds is written
  // verbatim rather than refused.
  //
  // `code_volume_letters` is nullable here and `code_number` is not, for the
  // same reason `label_id` is and `album_title` is not: the column is
  // nullable and clearing it has to be expressible, since omission means
  // "leave the stored value alone". An explicit null stores NULL; so does an
  // empty string, which the server trims and coalesces. `code_number` is NOT
  // NULL, so it has no cleared state to express.
  code_number?: number;
  code_volume_letters?: string | null;
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

/**
 * GET /library/artists/:id — the header of `/wxycdb`'s artist card
 * (`artistCardModify.jsp`).
 *
 * `code_artist_number` is genre-scoped (it lives on
 * `genre_artist_crossreference`), and the endpoint collapses a multi-genre
 * artist to its lowest `genre_id`, so `genre_id` here names which genre's code
 * this is — not merely which genre the artist is filed under.
 *
 * Deliberately carries no `last_modified`: the JSP shows a "Time Last
 * Modified" row for the artist and this endpoint does not project one.
 */
export type ArtistCard = {
  artist_id: number;
  artist_name: string;
  alphabetical_name: string;
  genre_id: number;
  code_letters: string;
  code_artist_number: number;
};

/**
 * PATCH /library/artists/:id.
 *
 * Two fields, not the JSP's five. The backend **rejects** `genre_id`,
 * `code_letters`, and `code_artist_number` with a 400 naming why rather than
 * dropping them silently, so widening this type would turn a compile-time
 * constraint into a runtime rejection. Those three have no write path
 * anywhere in Backend-Service.
 */
export type UpdateArtistRequestBody = {
  alphabetical_name: string;
  artist_name?: string;
};

/** One row of the artist card's release table (GET /library/artists/:id/releases). */
export type ArtistRelease = {
  id: number;
  last_modified: string;
  format_name: string;
  genre_id: number;
  code_letters: string;
  code_artist_number: number;
  code_number: number;
  code_volume_letters: string | null;
  album_title: string;
  alternate_artist_name: string | null;
};

export type ArtistReleasesQuery = {
  artistId: number;
  page?: number;
  limit?: number;
};

export type ArtistReleasesResponse = {
  artist_id: number;
  releases: ArtistRelease[];
  total: number;
  page: number;
  totalPages: number;
};

export type PeekArtistCodeQuery = {
  code_letters: string;
  genre_id: number;
};

export type PeekArtistCodeResponse = {
  next_code_number: number;
};

/**
 * GET /library/artists/:id/next-release-number — the call number a new
 * release filed under this artist, on this genre's shelf, would be assigned
 * (that shelf's MAX(code_number)+1, or 1 when it holds no releases yet).
 * Genre-scoped because an artist catalogued under more than one genre keeps a
 * separate numbering sequence per genre -- a peek that did not name one could
 * answer off a shelf other than the one the release is actually being filed
 * on.
 */
export type NextReleaseNumberQuery = {
  artistId: number;
  /**
   * The genre whose shelf to answer off. Today this is always
   * `ArtistCard.genre_id`, which for an artist catalogued under more than one
   * genre is the LOWEST of them -- `getArtistCardByIdInGenre` collapses a
   * multi-genre artist that way, so the card, and therefore this peek, report
   * that genre's shelf rather than one the librarian chose.
   *
   * That is an accepted limit, not a defect to route around here: a
   * multi-genre artist filing under a higher genre gets a number off the lower
   * genre's shelf. Closing it needs a genre the librarian selects, which is a
   * change to the card, not to this type. Do NOT build on an assumption that
   * this already names the genre being filed under -- it names the genre the
   * card is showing, and for a single-genre artist those coincide.
   */
  genre_id: number;
};

/**
 * The classic add-release form prepopulates its editable call-number field
 * from this so the librarian sees the number that will land on the sleeve
 * before saving, rather than a blank. Same wire shape as the peek-code
 * preview, kept as its own type so the two endpoints' contracts can evolve
 * independently.
 */
export type NextReleaseNumberResponse = {
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
 * The same endpoint read without a genre filter: `GET /library/artists/search`
 * with no `genre_id` searches the whole library and answers one row per
 * (artist, genre) membership, each carrying the genre whose code number it
 * names. Published rather than mirrored, and re-exported here so the catalog
 * feature has one place to look for its wire types.
 *
 * `genre_id` and `genre_name` are declared optional by the contract even
 * though Backend returns them on every row in both search modes — the joins
 * that produce them are INNER either way. Read "optional" as "the contract
 * declines to promise it", not "the server omits it".
 */
export type { ArtistSearchMatch, ArtistSearchResponse };

/**
 * `limit` is clamped into 1..20 *in the service*, but only for values it
 * recognizes as numbers: zero, a negative, and a non-integer all fall back to
 * the default of 10 rather than to 1. A caller that wants the widest window
 * asks for 20; there is no arg here that means "one row".
 */
export type LibraryArtistSearchParams = {
  q: string;
  limit?: number;
};

/**
 * `by-code`'s query, at either of its two specificities. An ABSENT
 * `code_number` browses the whole `(genre_id, code_letters)` bucket ordered by
 * the number each artist holds -- `chooseLibraryCodeOrArtist.jsp`'s
 * blank-call-number path. A present one resolves the single triple.
 *
 * Optional means absent, not empty. The endpoint still 400s a
 * present-but-empty `code_number=`, because `Number('')` is 0 and 0 is a
 * legitimate Various Artists filing, so browsing on it would hide a client bug
 * behind a plausible answer. `fetchBaseQuery` strips an undefined param, which
 * is why leaving this `undefined` is the correct way to browse and building a
 * `""` is not.
 */
export type ResolveArtistByCodeQuery = {
  genre_id: number;
  code_letters: string;
  code_number?: number;
};

/**
 * One artist filed under a `(genre_id, code_letters)` pair, with the number it
 * holds there.
 *
 * `genre_id` and `code_letters` are constant across a response -- they are the
 * query. **`code_number` is not**, and hoisting it out of the rows is the
 * mistake this doc exists to prevent. A fully-specified lookup returns several
 * artists that collide on one number (Backend-Service's `getArtistsByCode`
 * documents 13 production collisions, the largest a Various-Artists bucket of
 * 27), so there the number happens to repeat. A number-less browse returns the
 * whole bucket, where it varies row to row and is the entire reason the
 * librarian asked: they read the highest assigned number off the bottom of the
 * list. Both responses have the same wire shape and typecheck identically, so
 * nothing but this will stop a reader from treating the first row's number as
 * the response's.
 */
export type ArtistByCodeOwner = {
  id: number;
  artist_name: string;
  code_letters: string;
  code_number: number;
  genre_id: number;
};

/**
 * `null` means the body could not be read as this shape at all -- a JSON 200
 * carrying `{}`, `null`, or a renamed payload. It is NOT a wire value; the
 * endpoint's `transformResponse` manufactures it so that "unreadable" and
 * "genuinely nobody" stay distinguishable in the client.
 *
 * They must, because the browse made them mean opposite things. A
 * fully-specified lookup refuses an empty list either way, so collapsing the
 * two was safe there. A browse ACTS on an empty list -- unused call letters
 * are a normal answer -- so collapsing them would render an unreadable
 * response as "nothing is filed under these letters" for a shelf section that
 * may hold two hundred artists. `surfaceNonJsonAsError` does not cover this:
 * the body in question is valid JSON.
 */
export type ResolveArtistByCodeResponse = {
  artists: ArtistByCodeOwner[] | null;
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

/**
 * `GET /library/:id/flowsheet-play-counts` — the release's flowsheet plays,
 * counted by the three disjoint arms a delete can affect. Hand-written here
 * rather than imported from `@wxyc/shared`: the endpoint is not declared in
 * `wxyc-shared/api.yaml`.
 *
 * `direct` and `rotation_linked` are plays that actually link to this release
 * (via `flowsheet.album_id`, or transitively via `flowsheet.rotation_id` ->
 * `rotation.album_id`) and lose that link when the release is deleted.
 * `legacy_linked` is different in kind, not just in path: it counts plays
 * that name this release only by a bare `legacy_release_id`, still waiting on
 * `jobs/legacy-linkage-resolve` to become a real link. Deleting the release
 * does not unlink those plays — there was never a link — it stops them from
 * ever being linked at all. The three counts must never be summed into one
 * total; see `formatReleaseDeletePlayImpact`, the one place that renders
 * them.
 */
export type FlowsheetPlayCounts = {
  direct: number;
  rotation_linked: number;
  legacy_linked: number;
};

/** @deprecated use AddAlbumRequestBody */
export type AlbumParams = AddAlbumRequestBody;

/** @deprecated use AddArtistRequestBody */
export type ArtistParams = AddArtistRequestBody;

export type AlbumEntry = {
  /**
   * Backend's `library.id` serial — the id every write path sends as
   * `album_id`, and the only id an endpoint under `/library/:id` accepts.
   * `null` where no library row is known.
   */
  id: number | null;
  /**
   * The row's tubafrenzy `LIBRARY_RELEASE_ID` (Backend's
   * `library.legacy_release_id`) — a **different id space** from `id`, and the
   * one the per-track store is keyed by. `null` where the source row has no
   * library row behind it (an unlinked rotation row) or predates the field.
   *
   * Required rather than optional on purpose: every failure mode of a missing
   * value is silent — a read resolves `null` and quietly returns nothing, a
   * dedupe quietly no-ops — so a conversion path that forgets to map it should
   * fail to compile rather than ship an `undefined`.
   */
  legacy_release_id: number | null;
  /**
   * INTERIM write-gate discriminator: true only for rows converted from an
   * LML search result — the one source whose `id` above is a legacy id
   * rather than a Backend serial, because LML's library.db has no other id
   * to give. `entryToFreezePayload` withholds `album_id` for flagged rows,
   * so a submission goes freeform instead of persisting a wrong-space album
   * link. Remove the flag and its gate together once the LML search proxy
   * emits a real Backend `library.id` in `id` — a gate left in place past
   * that point keeps the corrected links out of the flowsheet.
   */
  lml_source?: true;
  title: string;
  artist: ArtistEntry;
  entry: number;
  /**
   * The format name exactly as the server filed it. The vocabulary is
   * server-owned — `GET /library/formats` is the authority and a music
   * director creates a format by typing its name — so this is a plain string,
   * never a union dj-site maintains a copy of. A conversion path must carry
   * the value through unmodified; narrowing it to a locally-known set both
   * erases formats the station really shelves (`Cassette`) and renames ones it
   * recognises (`12" Vinyl` is not `Vinyl`).
   *
   * `"Unknown"` is dj-site's own fallback for a row that carries *no* format.
   * It is not a row in the library's format table, so it must only ever appear
   * where the source value was missing.
   */
  format: string;
  /**
   * The other half of the release's shelf code (`library.code_volume_letters`),
   * which subdivides one call number into volumes — `5-A` beside `5`. `null`
   * is a release with no volume letters; absent means the row came from a
   * source that carries no such column (a bin row, an LML-only search row),
   * which is why a reader must not read absence as "no letters".
   *
   * The published response contract does not declare the column even though
   * the album-detail read and the PATCH re-read both project it, so
   * `convertToAlbumEntry` reaches for it the way it reaches for every other
   * served-but-undeclared field on that row.
   */
  code_volume_letters?: string | null;
  alternate_artist: string | undefined;
  album_artist?: string;
  rotation_bin: Rotation | undefined;
  rotation_id: number | undefined;
  /** The rotation entry's named card, when known. Converted from search/rotation rows that carry the wire field (`AlbumSearchResult.card`, non-null only while actively rotating) and threaded from add/kill rotation mutation responses. `null` is the positive claim "on no card"; absent means no source has reported one. */
  card?: RotationCard | null;
  /**
   * The release's definitive (music-director) links, release-scoped and so
   * present regardless of rotation state. Rides the same conversion path as
   * `card`; folded into the Listen chips, overriding LML for a matching service
   * and adding a chip for one LML did not return. Bare-domain-safe rendering is
   * the consumer's responsibility (see `mergeListenLinks`).
   */
  urls?: string[];
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
  /**
   * The genre name exactly as the server filed it. The vocabulary is
   * server-owned — `GET /library/genres` is the authority and the table grows
   * without a dj-site deploy — so this is a plain string, never a union
   * dj-site maintains a copy of. A conversion path must carry the value
   * through unmodified; narrowing it to a locally-known set discards genres
   * the station really files under.
   *
   * `"Unknown"` is dj-site's own fallback for a row that carries *no* genre.
   * It is not a row in the library's genre table, so it must only ever appear
   * where the source value was missing.
   */
  genre: string;
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

/**
 * One row of `GET /library/crossreferences/artists` — a "see also" pointer a
 * librarian filed from one artist card to another, the collection
 * `xrefsToLibraryCodes.jsp` renders.
 *
 * Only the target carries a call number, matching the JSP's columns. The
 * target's genre is not served, so the code renders without the genre word
 * the JSP's `fullLibraryCode` prefixes.
 */
export type ArtistCrossReferenceRow = {
  source_artist_id: number;
  source_artist_name: string;
  target_artist_id: number;
  target_artist_name: string;
  target_code_letters: string;
  target_code_artist_number: number | null;
  comment: string | null;
};

/**
 * One row of `GET /library/crossreferences/releases`, the collection
 * `xrefsToLibraryReleases.jsp` renders.
 *
 * Two artists per row, and the difference between them is the association the
 * row records: `artist_id`/`artist_name` is the cross-REFERENCING artist,
 * while `album_artist_name` is whoever the cross-referenced release is filed
 * under. The call number belongs to the release and arrives as parts.
 */
export type ReleaseCrossReferenceRow = {
  artist_id: number;
  artist_name: string;
  library_id: number;
  album_title: string;
  album_artist_name: string | null;
  alternate_artist_name: string | null;
  format_name: string;
  genre_id: number;
  code_letters: string;
  code_artist_number: number | null;
  code_number: number;
  code_volume_letters: string | null;
  comment: string | null;
};

/** `?page=`/`?limit=` for either cross-reference listing. */
export type CrossReferenceQueryParams = {
  page?: number;
  limit?: number;
};

/** The page envelope both cross-reference listings share with `GET /library/query`. */
export type CrossReferencePage<Row> = {
  results: Row[];
  total: number;
  page: number;
  totalPages: number;
};

/**
 * `GET /library/releases/discogs-prefill?url=` — the fields a resolved Discogs
 * release lends the rotation filing bench (BS resolves the pasted link to this
 * via LML). Declared here, not imported from `@wxyc/shared`: the backend keeps
 * this an internal shape rather than a published contract type, so dj-site owns
 * its own mirror. Field names follow `AlbumCreateFields` (`album_title`,
 * `label`, `label_id`) plus the artist name and the Discogs identifiers.
 */
export type DiscogsReleasePrefill = {
  discogs_release_id: number;
  discogs_master_id: number | null;
  artist_name: string;
  album_title: string;
  label: string | null;
  label_id: number | null;
  year: number | null;
  discogs_artist_id: number | null;
  genres: string[];
  styles: string[];
  artwork_url: string | null;
};
