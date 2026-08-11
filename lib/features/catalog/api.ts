import { createApi } from "@reduxjs/toolkit/query/react";
import type { FetchBaseQueryError } from "@reduxjs/toolkit/query";
import type { RootState } from "@/lib/store";
import { backendBaseQuery } from "../backend";
import { isAddArtistConflict } from "./adminCreateArtistValidation";
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
  CompilationTrackInput,
  CompilationTrackList,
  CompilationTrackSuggestions,
  CompilationTracksWriteResponse,
  LibraryFormatRow,
  LibraryGenreRow,
  LibraryQueryParams,
  PeekArtistCodeQuery,
  PeekArtistCodeResponse,
  SearchArtistsInGenreParams,
  SearchArtistsInGenreResponse,
  SearchCatalogQueryParams,
  UpdateAlbumRequestBody,
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
  tagTypes: ["Rotation", "AlbumDetail", "CatalogList", "ArtistSearch", "FormatList", "GenreList", "ArtistCodePeek", "CompilationTracks"],
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
      providesTags: [{ type: "CatalogList", id: "LIST" }],
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
      invalidatesTags: [{ type: "CatalogList", id: "LIST" }],
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
      // server answered below 500, of which the code-taken 409 is the routine
      // one. Invalidating CatalogList/ArtistSearch on those would spend two
      // round trips reconfirming lists that cannot have changed. The peek tag
      // is the one exception: every 409 on this endpoint means the
      // code_letters/genre_id/code_number triple is taken, so it IS the
      // evidence that this cache entry — and only this one — is stale, since
      // it names the exact pair the preview just showed as free. That holds
      // regardless of whether the body happens to parse as
      // `isAddArtistConflict` — that check exists so the caller can name the
      // conflicting artist in a banner, not to decide whether the pair is
      // actually free. A 5xx or a transport failure still gets every tag —
      // the row may well have been written on a response the client never
      // saw, and ArtistSearch backs the typeahead that is all that stands
      // between a retry and a duplicate artist.
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
        return error.status === 409 ? [codePeekTag] : [];
      },
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
        result ? [{ type: "AlbumDetail", id: result.id }] : [],
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
  useLazyPeekArtistCodeQuery,
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
