import { createApi } from "@reduxjs/toolkit/query/react";
import { backendBaseQuery } from "../backend";
import { convertToAlbumEntry } from "./conversions";
import {
  AlbumEntry,
  AlbumParams,
  AlbumSearchResultJSON,
  AlbumRequestParams,
  ArtistParams,
  SearchCatalogQueryParams,
} from "./types";

export const catalogApi = createApi({
  reducerPath: "catalogApi",
  baseQuery: backendBaseQuery("library"),
  tagTypes: ["Rotation", "AlbumDetail"],
  endpoints: (builder) => ({
    searchCatalog: builder.query<AlbumEntry[], SearchCatalogQueryParams>({
      query: ({ artist_name, album_title, n }) => ({
        url: "/",
        params: { artist_name, album_title, n },
      }),
      transformResponse: (response: AlbumSearchResultJSON[]) =>
        response.map(convertToAlbumEntry),
    }),
    addAlbum: builder.mutation<any, AlbumParams>({
      query: (album) => ({
        url: "/",
        method: "POST",
        body: album,
      }),
    }),
    addArtist: builder.mutation<any, ArtistParams>({
      query: (artist) => ({
        url: "/artists",
        method: "POST",
        body: artist,
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
    getFormats: builder.query<any, void>({
      query: () => ({
        url: "/formats",
      }),
    }),
    addFormat: builder.mutation<any, string>({
      query: (format) => ({
        url: "/formats",
        method: "POST",
        body: format,
      }),
    }),
    getGenres: builder.query<any, void>({
      query: () => ({
        url: "/genres",
      }),
    }),
    addGenre: builder.mutation<any, string>({
      query: (genre) => ({
        url: "/genres",
        method: "POST",
        body: genre,
      }),
    }),
  }),
});

export const {
  useSearchCatalogQuery,
  useAddAlbumMutation,
  useAddArtistMutation,
  useGetInformationQuery,
  useGetFormatsQuery,
  useAddFormatMutation,
  useGetGenresQuery,
  useAddGenreMutation,
  useMarkMissingMutation,
  useMarkFoundMutation,
} = catalogApi;
