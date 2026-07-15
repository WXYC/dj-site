import { createApi } from "@reduxjs/toolkit/query/react";
import type { RootState } from "@/lib/store";
import { backendBaseQuery } from "../backend";
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
  tagTypes: ["Rotation", "AlbumDetail", "CatalogList", "ArtistSearch"],
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
      // paginated/sorted infinite query, so a new row can't be patched into the
      // cache coherently (its correct page may be unloaded). Invalidate the
      // list instead so the panel refetches — dj-site#624. No UI dispatches
      // this mutation yet; the tag is wired so the first adopter gets correct
      // cache behavior instead of the stale-list bug #624 documented.
      invalidatesTags: [{ type: "CatalogList", id: "LIST" }],
    }),
    updateAlbum: builder.mutation<AlbumEntry, { albumId: number; body: UpdateAlbumRequestBody }>({
      query: ({ albumId, body }) => ({
        url: `/${albumId}`,
        method: "PATCH",
        body,
      }),
      transformResponse: (response: AlbumSearchResultJSON) =>
        convertToAlbumEntry(response),
      invalidatesTags: (_result, _error, { albumId }) => [
        { type: "AlbumDetail", id: albumId },
      ],
      async onQueryStarted(_arg, { dispatch, queryFulfilled, getState }) {
        try {
          const { data: updated } = await queryFulfilled;
          patchCatalogSearchCaches(dispatch, getState as () => RootState, updated);
        } catch {
          // Leave caches untouched when save fails.
        }
      },
    }),
    addArtist: builder.mutation<
      { id: number; code_number?: number; genre_id?: number } & Record<string, unknown>,
      AddArtistRequestBody
    >({
      query: (body) => ({
        url: "/artists",
        method: "POST",
        body,
      }),
      // A new artist would surface in the artist typeahead (searchArtistsInGenre)
      // and can gate later album rows; refetch both rather than patch —
      // dj-site#624. Neither this mutation nor the typeahead has a UI consumer
      // yet — tags are wired for the first adopter, not a live flow.
      invalidatesTags: [
        { type: "CatalogList", id: "LIST" },
        { type: "ArtistSearch", id: "LIST" },
      ],
    }),
    peekArtistCode: builder.query<PeekArtistCodeResponse, PeekArtistCodeQuery>({
      query: ({ code_letters, genre_id }) => ({
        url: "/artists/peek-code",
        params: { code_letters, genre_id },
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
      transformResponse: (
        response: SearchArtistsInGenreResponse | null,
      ): SearchArtistsInGenreResponse =>
        response?.artists ? response : { artists: [] },
      providesTags: [{ type: "ArtistSearch", id: "LIST" }],
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
      transformResponse: (response: AlbumSearchResultJSON) =>
        convertToAlbumEntry(response),
      invalidatesTags: (_result, _error, { albumId }) => [
        { type: "AlbumDetail", id: albumId },
      ],
      async onQueryStarted(_arg, { dispatch, queryFulfilled, getState }) {
        try {
          const { data: updated } = await queryFulfilled;
          patchCatalogSearchCaches(dispatch, getState as () => RootState, updated);
        } catch {
          // Leave caches untouched when mark-missing fails.
        }
      },
    }),
    markFound: builder.mutation<AlbumEntry, { albumId: number }>({
      query: ({ albumId }) => ({
        url: `/${albumId}/found`,
        method: "PATCH",
      }),
      transformResponse: (response: AlbumSearchResultJSON) =>
        convertToAlbumEntry(response),
      invalidatesTags: (_result, _error, { albumId }) => [
        { type: "AlbumDetail", id: albumId },
      ],
      async onQueryStarted(_arg, { dispatch, queryFulfilled, getState }) {
        try {
          const { data: updated } = await queryFulfilled;
          patchCatalogSearchCaches(dispatch, getState as () => RootState, updated);
        } catch {
          // Leave caches untouched when mark-found fails.
        }
      },
    }),
    getFormats: builder.query<LibraryFormatRow[], void>({
      query: () => ({
        url: "/formats",
      }),
    }),
    addFormat: builder.mutation<LibraryFormatRow, AddFormatRequestBody>({
      query: (body) => ({
        url: "/formats",
        method: "POST",
        body,
      }),
    }),
    getGenres: builder.query<LibraryGenreRow[], void>({
      query: () => ({
        url: "/genres",
      }),
    }),
    addGenre: builder.mutation<LibraryGenreRow, AddGenreRequestBody>({
      query: (body) => ({
        url: "/genres",
        method: "POST",
        body,
      }),
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
  useLazySearchArtistsInGenreQuery,
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
