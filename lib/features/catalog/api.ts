import { createApi } from "@reduxjs/toolkit/query/react";
import { backendBaseQuery } from "../backend";
import { convertToAlbumEntry } from "./conversions";
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
  SearchCatalogQueryParams,
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

export const catalogApi = createApi({
  reducerPath: "catalogApi",
  baseQuery: backendBaseQuery("library"),
  tagTypes: ["Rotation", "AlbumDetail"],
  endpoints: (builder) => ({
    searchCatalog: builder.query<AlbumEntry[], SearchCatalogQueryParams>({
      query: ({ artist_name, album_title, n, on_streaming }) => ({
        url: "/",
        params: { artist_name, album_title, n, on_streaming },
      }),
      transformResponse: (response: AlbumSearchResultJSON[]) =>
        response.map(convertToAlbumEntry),
    }),
    searchLibraryQuery: builder.query<LibraryQueryResult, LibraryQueryParams>({
      query: (params) => ({
        url: "/query",
        params,
      }),
      transformResponse: (
        response: LibraryQueryResponseJSON | null,
      ): LibraryQueryResult =>
        response?.results
          ? {
              results: response.results.map(convertToAlbumEntry),
              total: response.total ?? 0,
              page: response.page ?? 0,
              totalPages: response.totalPages ?? 0,
            }
          : { results: [], total: 0, page: 0, totalPages: 0 },
    }),
    addAlbum: builder.mutation<{ id: number } & Record<string, unknown>, AddAlbumRequestBody>({
      query: (body) => ({
        url: "/",
        method: "POST",
        body,
      }),
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
    }),
    peekArtistCode: builder.query<PeekArtistCodeResponse, PeekArtistCodeQuery>({
      query: ({ code_letters, genre_id }) => ({
        url: "/artists/peek-code",
        params: { code_letters, genre_id },
      }),
    }),
    getInformation: builder.query<AlbumEntry, AlbumRequestParams>({
      query: ({ album_id }) => ({
        url: "/info",
        params: { album_id },
      }),
      transformResponse: (response: AlbumSearchResultJSON) =>
        convertToAlbumEntry(response),
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
  useAddAlbumMutation,
  useAddArtistMutation,
  useLazyPeekArtistCodeQuery,
  useGetInformationQuery,
  useGetFormatsQuery,
  useAddFormatMutation,
  useGetGenresQuery,
  useAddGenreMutation,
  useMarkMissingMutation,
  useMarkFoundMutation,
} = catalogApi;
