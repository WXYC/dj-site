import { createApi } from "@reduxjs/toolkit/query/react";
import type { FetchBaseQueryError } from "@reduxjs/toolkit/query";
import type { RootState } from "@/lib/store";
import { hasLinkedAlbumId } from "../flowsheet/linkage";
import { backendBaseQuery } from "../backend";
import {
  isAddArtistConflict,
  isArtistNameConflictData,
} from "./adminCreateArtistValidation";
import { CATALOG_QUERY_PAGE_LIMIT } from "./constants";
import { convertToAlbumEntry } from "./conversions";
import { patchCatalogSearchCaches } from "./patchSearchCaches";
import {
  AddAlbumRequestBody,
  AddArtistRequestBody,
  AddFormatRequestBody,
  AddGenreRequestBody,
  AlbumEntry,
  AlbumSearchResultJSON,
  AlbumRequestParams,
  ArtistCard,
  ArtistReleasesQuery,
  ArtistReleasesResponse,
  CompilationTrackInput,
  CompilationTrackList,
  CompilationTrackSuggestions,
  CompilationTracksWriteResponse,
  LibraryFormatRow,
  LibraryGenreRow,
  LibraryQueryParams,
  PeekArtistCodeQuery,
  PeekArtistCodeResponse,
  ResolveArtistByCodeQuery,
  ResolveArtistByCodeResponse,
  SearchArtistsInGenreParams,
  SearchArtistsInGenreResponse,
  SearchCatalogQueryParams,
  UpdateAlbumRequestBody,
  UpdateArtistRequestBody,
} from "./types";

type LibraryQueryResponseJSON = {
  results: AlbumSearchResultJSON[];
  total: number;
  page: number;
  totalPages: number;
};

export type LibraryQueryResult = {
  results: AlbumEntry[];
  total: number;
  page: number;
  totalPages: number;
};

/** Args for infinite catalog search — `page` and `limit` come from `pageParam` / constant. */
export type CatalogInfiniteQueryArg = Omit<
  LibraryQueryParams,
  "page" | "limit"
>;

function transformLibraryQueryResponse(
  response: LibraryQueryResponseJSON | null,
): LibraryQueryResult {
  return response?.results
    ? {
        results: response.results.map(convertToAlbumEntry),
        total: response.total ?? 0,
        page: response.page ?? 0,
        totalPages: response.totalPages ?? 0,
      }
    : { results: [], total: 0, page: 0, totalPages: 0 };
}

export const catalogApi = createApi({
  reducerPath: "catalogApi",
  baseQuery: backendBaseQuery("library"),
  tagTypes: ["Rotation", "AlbumDetail", "CatalogList", "ArtistSearch", "FormatList", "GenreList", "ArtistCodePeek", "CompilationTracks", "ArtistCard", "ArtistReleaseList"],
  endpoints: (builder) => ({
    searchCatalog: builder.query<AlbumEntry[], SearchCatalogQueryParams>({
      query: ({ artist_name, album_title, n, on_streaming }) => ({
        url: "/",
        params: { artist_name, album_title, n, on_streaming },
      }),
      transformResponse: (response: AlbumSearchResultJSON[] | null) =>
        response ? response.map(convertToAlbumEntry) : [],
      // A single LIST tag (not per-row AlbumDetail): updateAlbum/markMissing/
      // markFound patch existing rows in place via patchCatalogSearchCaches, so
      // this tag only needs to force a refetch when a brand-new row is added
      // (addAlbum/addArtist) — see dj-site#624.
      providesTags: [{ type: "CatalogList", id: "LIST" }],
    }),
    searchLibraryQuery: builder.query<LibraryQueryResult, LibraryQueryParams>({
      query: (params) => ({
        url: "/query",
        params,
      }),
      transformResponse: (response: LibraryQueryResponseJSON | null) =>
        transformLibraryQueryResponse(response),
      // Per-row AlbumDetail tags on top of the list tag. This endpoint serves
      // status-filtered views (`missing: true`) whose membership a single-row
      // PATCH changes, and — unlike its infinite sibling —
      // `patchCatalogSearchCaches` never reaches it, so without these tags a
      // fulfilled markFound/markMissing/updateAlbum leaves the row on screen
      // still carrying the status it just lost, with `total` disagreeing with
      // the server. A reader acting on that stale row re-issues a PATCH that
      // already succeeded. Rows whose id was synthesized client-side carry no
      // server identity, so they name no tag.
      providesTags: (result) => [
        { type: "CatalogList", id: "LIST" },
        ...(result?.results ?? []).flatMap((row) =>
          hasLinkedAlbumId(row.id)
            ? [{ type: "AlbumDetail" as const, id: row.id }]
            : [],
        ),
      ],
    }),
    searchLibraryQueryInfinite: builder.infiniteQuery<
      LibraryQueryResult,
      CatalogInfiniteQueryArg,
      number
    >({
      infiniteQueryOptions: {
        initialPageParam: 0,
        getNextPageParam: (lastPage, _allPages, lastPageParam) =>
          lastPage.page + 1 >= lastPage.totalPages
            ? undefined
            : lastPageParam + 1,
      },
      query({ pageParam, queryArg }) {
        return {
          url: "/query",
          params: {
            ...queryArg,
            page: pageParam,
            limit: CATALOG_QUERY_PAGE_LIMIT,
          },
        };
      },
      transformResponse: (
        response: LibraryQueryResponseJSON | null,
      ): LibraryQueryResult => transformLibraryQueryResponse(response),
      providesTags: [{ type: "CatalogList", id: "LIST" }],
    }),
    addAlbum: builder.mutation<{ id: number } & Record<string, unknown>, AddAlbumRequestBody>({
      query: (body) => ({
        url: "/",
        method: "POST",
        body,
      }),
      // The POST response isn't a full AlbumEntry and the browse is a
      // paginated/sorted infinite query, so a new row can't be patched into
      // the cache coherently (its correct page may be unloaded). Invalidate
      // the list instead so the panel refetches.
      //
      // The artist card's release table is invalidated for a second reason,
      // not the same one: its shelf order is server-assigned. `POST /library`
      // derives `code_number` itself (`generateAlbumCodeNumber`, max+1 for the
      // artist), so the client cannot know where the new row lands, and the
      // add-release form sits directly above the table it changes. Keyed by
      // the artist the release was filed under -- when the caller identified
      // that artist by id. A caller that sent only `artist_name` leaves the
      // backend to resolve the id, so the specific list to refresh isn't
      // knowable here; those invalidate the whole tag rather than guessing.
      invalidatesTags: (_result, _error, body) => [
        { type: "CatalogList", id: "LIST" },
        {
          type: "ArtistReleaseList",
          id: body.artist_id != null ? String(body.artist_id) : "LIST",
        },
      ],
    }),
    updateAlbum: builder.mutation<AlbumEntry, { albumId: number; body: UpdateAlbumRequestBody }>({
      query: ({ albumId, body }) => ({
        url: `/${albumId}`,
        method: "PATCH",
        body,
      }),
      // A JSON `null` body (malformed upstream response) is guarded here
      // rather than left to crash inside `convertToAlbumEntry` — its opening
      // `"id" in response` throws on `null` — so the rejection this endpoint
      // produces is an intentional one, not a stray `TypeError`.
      transformResponse: (response: AlbumSearchResultJSON | null) => {
        if (!response) throw new Error("updateAlbum: response body was empty");
        return convertToAlbumEntry(response);
      },
      invalidatesTags: (_result, _error, { albumId }) => [
        { type: "AlbumDetail", id: albumId },
      ],
      async onQueryStarted(_arg, { dispatch, queryFulfilled, getState }) {
        try {
          const { data: updated } = await queryFulfilled;
          patchCatalogSearchCaches(dispatch, getState as () => RootState, updated);
        } catch {
        }
      },
    }),
    addArtist: builder.mutation<
      {
        id: number;
        code_letters?: string;
        code_number?: number;
        genre_id?: number;
      } & Record<string, unknown>,
      AddArtistRequestBody
    >({
      query: (body) => ({
        url: "/artists",
        method: "POST",
        body,
      }),
      // The 409 body carries the conflicting artist, which the caller renders
      // inline by name. Its generic `message` is dropped here so the global
      // rejected-query middleware — which toasts any `data.message` — stays
      // quiet and that recoverable outcome is reported once rather than as a
      // banner plus a generic failure toast. The strip is confined to bodies
      // the caller can actually name an artist from, so any other 409 keeps
      // whatever reason the server sent.
      transformErrorResponse: (error) => {
        if (!isAddArtistConflict(error)) return error;
        const data = { ...(error.data as unknown as Record<string, unknown>) };
        delete data.message;
        return { ...error, data };
      },
      // A new artist can appear in the artist typeahead (searchArtistsInGenre)
      // and gates the album rows filed under it, and neither cache can absorb
      // the row by patch: typeahead entries are keyed by the search args the
      // new name may not match, and the browse is a paginated/sorted infinite
      // query whose correct page may be unloaded. Invalidate both instead.
      // Also invalidate the peek-code preview for the exact code_letters/genre_id
      // pair just filled: without this, a cached preview for that pair keeps
      // showing the pre-add code number to an MD who revisits it in the same
      // session, even though the backend would now reject it as taken.
      //
      // Invalidation fires on a rejected mutation as well as a fulfilled one,
      // so the rejections that provably wrote nothing opt out: anything the
      // server answered below 500, of which a 409 is the routine one.
      // Invalidating CatalogList/ArtistSearch on those would spend two round
      // trips reconfirming lists that cannot have changed. The peek tag is
      // narrower still: a code-triple conflict names the exact
      // code_letters/genre_id pair the preview just showed as free, so it IS
      // evidence that cache entry is stale — regardless of whether the body
      // happens to parse as `isAddArtistConflict`, which exists so the caller
      // can name the conflicting artist in a banner, not to decide whether
      // the pair is actually free. A genre-scoped artist-name conflict is not
      // that evidence: it says nothing about the code triple at all, so
      // `isArtistNameConflictData` carves it out rather than invalidating a
      // cache entry the rejection gives no reason to distrust. A 5xx or a
      // transport failure still gets every tag — the row may well have been
      // written on a response the client never saw, and ArtistSearch backs
      // the typeahead that is all that stands between a retry and a
      // duplicate artist.
      invalidatesTags: (_result, error, { code_letters, genre_id }) => {
        const codePeekTag = {
          type: "ArtistCodePeek" as const,
          id: `${genre_id}:${code_letters}`,
        };
        const wroteNothing =
          !!error && typeof error.status === "number" && error.status < 500;
        if (!wroteNothing) {
          return [
            { type: "CatalogList", id: "LIST" },
            { type: "ArtistSearch", id: "LIST" },
            codePeekTag,
          ];
        }
        if (error.status !== 409) return [];
        return isArtistNameConflictData(error.data) ? [] : [codePeekTag];
      },
    }),
    /** The header of `/wxycdb`'s artist card (`artistCardModify.jsp`). */
    getArtistCard: builder.query<ArtistCard, number>({
      query: (artistId) => ({ url: `/artists/${artistId}` }),
      // The shared base query soft-fails an unparseable body into a
      // successful `null` payload. Here that would render as an artist card
      // with blank names and a blank shelf code -- a screen that looks like a
      // catalogued artist with missing data rather than like an outage, and
      // whose add-release form would then file against an id the librarian
      // was never shown the name of.
      extraOptions: { surfaceNonJsonAsError: true },
      providesTags: (_result, _error, artistId) => [
        { type: "ArtistCard", id: String(artistId) },
      ],
    }),
    /**
     * `modifyArtist`'s one writable field. See `UpdateArtistRequestBody` for
     * why the JSP's other four are absent.
     */
    updateArtistCard: builder.mutation<
      { id: number; artist_name: string; alphabetical_name: string },
      { artistId: number; body: UpdateArtistRequestBody }
    >({
      query: ({ artistId, body }) => ({
        url: `/artists/${artistId}`,
        method: "PATCH",
        body,
      }),
      // The card refetches so the row reflects what was stored rather than
      // what was typed -- the backend NFC-normalizes `alphabetical_name` on
      // write, so the two can legitimately differ.
      invalidatesTags: (_result, _error, { artistId }) => [
        { type: "ArtistCard", id: String(artistId) },
      ],
    }),
    /** The artist card's release table, in shelf order. */
    getArtistReleases: builder.query<ArtistReleasesResponse, ArtistReleasesQuery>({
      query: ({ artistId, page, limit }) => ({
        url: `/artists/${artistId}/releases`,
        params: { ...(page != null ? { page } : {}), ...(limit != null ? { limit } : {}) },
      }),
      // Same opt-out as the card above, for the sharper reason: soft-failing
      // resolves to `{ releases: [] }`, which this screen renders as the JSP's
      // "The artist does not have any library releases" -- a positive claim
      // about the shelf. A librarian who believes it files a duplicate.
      extraOptions: { surfaceNonJsonAsError: true },
      providesTags: (_result, _error, { artistId }) => [
        { type: "ArtistReleaseList", id: String(artistId) },
        { type: "ArtistReleaseList", id: "LIST" },
      ],
    }),
    peekArtistCode: builder.query<PeekArtistCodeResponse, PeekArtistCodeQuery>({
      query: ({ code_letters, genre_id }) => ({
        url: "/artists/peek-code",
        params: { code_letters, genre_id },
      }),
      providesTags: (_result, _error, { code_letters, genre_id }) => [
        { type: "ArtistCodePeek", id: `${genre_id}:${code_letters}` },
      ],
    }),
    /**
     * Resolves a fully-specified library code (`chooseLibraryCodeOrArtist.jsp`'s
     * `artistSearchForm`, `mode=findOrCreateLibraryCode`) to the artist(s) that
     * own it. A 200 always carries one or more owners -- more than one is the
     * `multipleArtistsDisplay.jsp` disambiguation case, not an error; a 404
     * distinguishes an unknown genre from a code simply not assigned in a
     * genre that does exist (`reason: 'genre_not_found' | 'code_not_assigned'`).
     *
     * Same opt-out and reasoning as `searchArtistsInGenre`: the shared base
     * query soft-fails an unparseable body (a gateway's HTML 502, Express's
     * HTML 404) into a successful `null`, which here would read as "code not
     * assigned" -- the one answer an unreachable backend must not give, since
     * the chooser acts on it by routing the librarian to create a fresh
     * artist under that exact code.
     */
    resolveArtistByCode: builder.query<ResolveArtistByCodeResponse, ResolveArtistByCodeQuery>({
      query: ({ genre_id, code_letters, code_number }) => ({
        url: "/artists/by-code",
        params: { genre_id, code_letters, code_number },
      }),
      extraOptions: { surfaceNonJsonAsError: true },
      // Never read from cache: the trigger always refetches, and a stale
      // `code_not_assigned` is the one answer that routes the librarian into
      // creating a duplicate. Dropping the entry as soon as the form lets go
      // keeps that impossible by construction rather than by the trigger's
      // default, and is why the endpoint carries no `providesTags`.
      keepUnusedDataFor: 0,
      // Unlike its two models, an empty list is not a legal answer here -- an
      // unassigned code is a 404 carrying `code_not_assigned`. So this guard
      // is not making a missing `artists` mean "none": it is normalizing an
      // unreadable body onto the one value the caller already refuses to act
      // on, so both arrive at the same refusal instead of one of them
      // throwing mid-handler.
      transformResponse: (
        response: ResolveArtistByCodeResponse | null,
      ): ResolveArtistByCodeResponse =>
        response?.artists ? response : { artists: [] },
      // The chooser handles every failure shape inline (see
      // `resolveArtistByCodeErrorReason`), including the two structured 404
      // reasons -- neither is a surprise the shared rtk-query-error-logger
      // middleware should also toast. Wrapping hides `data.message` from
      // that middleware entirely, same technique as searchArtistsInGenre for
      // the same reason: one message, from the screen that has the context
      // to state it precisely, not two.
      transformErrorResponse: (
        response: FetchBaseQueryError,
      ): { resolveArtistByCodeError: FetchBaseQueryError } => ({
        resolveArtistByCodeError: response,
      }),
    }),
    searchArtistsInGenre: builder.query<
      SearchArtistsInGenreResponse,
      SearchArtistsInGenreParams
    >({
      query: ({ genre_id, q, limit }) => ({
        url: "/artists/search",
        params: { genre_id, q, limit },
      }),
      // The shared base query soft-fails an unparseable body — a gateway's
      // HTML 502, Express's HTML 404 — into a successful `null` payload,
      // which here resolves to "no such artist is catalogued". That is the
      // one answer an unreachable backend cannot honestly give: this search
      // backs the artist typeahead's duplicate-artist guard, so a false
      // no-match during an outage is what lets the librarian file the
      // near-duplicate the guard exists to prevent. Opt out so an outage
      // reaches the typeahead as an error it can refuse to act on.
      extraOptions: { surfaceNonJsonAsError: true },
      transformResponse: (
        response: SearchArtistsInGenreResponse | null,
      ): SearchArtistsInGenreResponse =>
        response?.artists ? response : { artists: [] },
      // The typeahead renders its own inline "Artist search is unavailable"
      // panel for every failure shape here — the opt-out above turns a
      // non-JSON body into this same isError state. The shared
      // rtk-query-error-logger middleware reporting it a second time as a
      // global toast would double the same outage for a screen-reader user
      // without adding any information; see searchLabels for the identical
      // nesting.
      transformErrorResponse: (
        response: FetchBaseQueryError,
      ): { searchArtistsInGenreError: FetchBaseQueryError } => ({
        searchArtistsInGenreError: response,
      }),
      providesTags: [{ type: "ArtistSearch", id: "LIST" }],
    }),
    getCompilationTracks: builder.query<CompilationTrackList, { libraryId: number }>({
      query: ({ libraryId }) => ({
        url: `/${libraryId}/compilation-tracks`,
      }),
      // Opted out of the shared non-JSON soft-fail for the same reason the
      // label search is: soft-failing would turn an unreadable response into
      // the claim "this release has no per-track credits", and callers act on
      // that claim by offering to write the credits themselves.
      extraOptions: { surfaceNonJsonAsError: true },
      // Guards a well-formed 200 whose body omits `tracks`: consumers iterate
      // it directly, and a missing array would crash them mid-render rather
      // than resolving to the empty set the shape promises.
      transformResponse: (
        response: CompilationTrackList | null,
        _meta,
        { libraryId },
      ): CompilationTrackList => ({
        // Falls back to the id that was asked for rather than inventing one:
        // a fabricated `0` is a value a later consumer could act on.
        library_id: response?.library_id ?? libraryId,
        tracks: response?.tracks ?? [],
      }),
      providesTags: (_result, _error, { libraryId }) => [
        { type: "CompilationTracks", id: libraryId },
      ],
    }),
    getCompilationTrackSuggestions: builder.query<
      CompilationTrackSuggestions,
      { libraryId: number }
    >({
      query: ({ libraryId }) => ({
        url: `/${libraryId}/compilation-tracks/discogs-suggestions`,
      }),
      // Same opt-out, and the stakes are higher here: the soft-fail's `null`
      // is indistinguishable from the upstream's genuine `discogs_release_id:
      // null` + empty `tracks`, which is precisely the signal that sends the
      // librarian to hand-enter a tracklist of arbitrary length. An outage must
      // not be able to impersonate "Discogs knows nothing about this release".
      extraOptions: { surfaceNonJsonAsError: true },
      // See getCompilationTracks: same guard against a 200 that omits `tracks`.
      transformResponse: (
        response: CompilationTrackSuggestions | null,
        _meta,
        { libraryId },
      ): CompilationTrackSuggestions => ({
        library_id: response?.library_id ?? libraryId,
        discogs_release_id: response?.discogs_release_id ?? null,
        tracks: response?.tracks ?? [],
      }),
    }),
    writeCompilationTracks: builder.mutation<
      CompilationTracksWriteResponse,
      { libraryId: number; tracks: CompilationTrackInput[] }
    >({
      query: ({ libraryId, tracks }) => ({
        url: `/${libraryId}/compilation-tracks`,
        method: "POST",
        body: { tracks },
      }),
      // Additive-only server-side: this can add credits to a release, never
      // amend or remove one. Callers must not present it as a way to correct a
      // tracklist that already has stored rows — a corrected row posted here
      // lands *alongside* the row it was meant to replace, and both stay
      // searchable, with the response's `skipped` count as the only hint.
      invalidatesTags: (_result, _error, { libraryId }) => [
        { type: "CompilationTracks", id: libraryId },
      ],
    }),
    getInformation: builder.query<AlbumEntry | undefined, AlbumRequestParams>({
      query: ({ album_id }) => ({
        url: "/info",
        params: { album_id },
      }),
      transformResponse: (response: AlbumSearchResultJSON | null) =>
        response ? convertToAlbumEntry(response) : undefined,
      providesTags: (result) =>
        // `/library/info` always resolves an existing catalog row — id is
        // never null here, but the shared AlbumEntry type accommodates LML
        // rows that never reach this endpoint.
        result ? [{ type: "AlbumDetail", id: result.id ?? undefined }] : [],
    }),
    markMissing: builder.mutation<AlbumEntry, { albumId: number }>({
      query: ({ albumId }) => ({
        url: `/${albumId}/missing`,
        method: "PATCH",
      }),
      // See updateAlbum's transformResponse: guards the same JSON-`null`-body
      // case with an intentional rejection instead of an unguarded crash.
      transformResponse: (response: AlbumSearchResultJSON | null) => {
        if (!response) throw new Error("markMissing: response body was empty");
        return convertToAlbumEntry(response);
      },
      invalidatesTags: (_result, _error, { albumId }) => [
        { type: "AlbumDetail", id: albumId },
      ],
      async onQueryStarted(_arg, { dispatch, queryFulfilled, getState }) {
        try {
          const { data: updated } = await queryFulfilled;
          patchCatalogSearchCaches(dispatch, getState as () => RootState, updated);
        } catch {
        }
      },
    }),
    markFound: builder.mutation<AlbumEntry, { albumId: number }>({
      query: ({ albumId }) => ({
        url: `/${albumId}/found`,
        method: "PATCH",
      }),
      // See updateAlbum's transformResponse: guards the same JSON-`null`-body
      // case with an intentional rejection instead of an unguarded crash.
      transformResponse: (response: AlbumSearchResultJSON | null) => {
        if (!response) throw new Error("markFound: response body was empty");
        return convertToAlbumEntry(response);
      },
      invalidatesTags: (_result, _error, { albumId }) => [
        { type: "AlbumDetail", id: albumId },
      ],
      async onQueryStarted(_arg, { dispatch, queryFulfilled, getState }) {
        try {
          const { data: updated } = await queryFulfilled;
          patchCatalogSearchCaches(dispatch, getState as () => RootState, updated);
        } catch {
        }
      },
    }),
    getFormats: builder.query<LibraryFormatRow[], void>({
      query: () => ({
        url: "/formats",
      }),
      providesTags: [{ type: "FormatList", id: "LIST" }],
    }),
    addFormat: builder.mutation<LibraryFormatRow, AddFormatRequestBody>({
      query: (body) => ({
        url: "/formats",
        method: "POST",
        body,
      }),
      invalidatesTags: [{ type: "FormatList", id: "LIST" }],
    }),
    getGenres: builder.query<LibraryGenreRow[], void>({
      query: () => ({
        url: "/genres",
      }),
      providesTags: [{ type: "GenreList", id: "LIST" }],
    }),
    addGenre: builder.mutation<LibraryGenreRow, AddGenreRequestBody>({
      query: (body) => ({
        url: "/genres",
        method: "POST",
        body,
      }),
      invalidatesTags: [{ type: "GenreList", id: "LIST" }],
    }),
  }),
});

export const {
  useSearchCatalogQuery,
  useLazySearchLibraryQueryQuery,
  useSearchLibraryQueryQuery,
  useSearchLibraryQueryInfiniteInfiniteQuery,
  useAddAlbumMutation,
  useUpdateAlbumMutation,
  useAddArtistMutation,
  useGetArtistCardQuery,
  useUpdateArtistCardMutation,
  useGetArtistReleasesQuery,
  useLazyPeekArtistCodeQuery,
  useLazyResolveArtistByCodeQuery,
  useSearchArtistsInGenreQuery,
  useGetCompilationTracksQuery,
  useGetCompilationTrackSuggestionsQuery,
  useWriteCompilationTracksMutation,
  useGetInformationQuery,
  useGetFormatsQuery,
  useAddFormatMutation,
  useGetGenresQuery,
  useAddGenreMutation,
  useMarkMissingMutation,
  useMarkFoundMutation,
} = catalogApi;

/** RTK names infinite-query hooks `use{EndpointName}InfiniteQuery`. */
export { useSearchLibraryQueryInfiniteInfiniteQuery as useSearchLibraryQueryInfiniteQuery };
