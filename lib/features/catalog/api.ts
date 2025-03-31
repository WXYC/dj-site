import { createApi } from "@reduxjs/toolkit/query/react";
import { backendBaseQuery } from "../backend";
import {
  convertAlbumFromRotation,
  convertAlbumFromSearch,
} from "./conversions";
import {
  AlbumEntry,
  AlbumParams,
  AlbumQueryResponse,
  AlbumRequestParams,
  ArtistParams,
  KillRotationParams,
  RotationParams,
  SearchCatalogQueryParams,
} from "./types";

export const catalogApi = createApi({
  reducerPath: "catalogApi",
  baseQuery: backendBaseQuery("library"),
  tagTypes: ["Rotation"],
  endpoints: (builder) => ({
    searchCatalog: builder.query<AlbumEntry[], SearchCatalogQueryParams>({
      query: ({ artist_name, album_name, n }) => ({
        url: "/",
        params: { artist_name, album_name, n },
      }),
      transformResponse: (response: AlbumQueryResponse[]) =>
        response.map(convertAlbumFromSearch),
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
    getRotation: builder.query<AlbumEntry[], void>({
      query: () => ({
        url: "/rotation",
      }),
      transformResponse: (response: AlbumQueryResponse[]) =>
        response.map(convertAlbumFromRotation),
      providesTags: ["Rotation"],
    }),
    addRotationEntry: builder.mutation<any, RotationParams>({
      query: (rotation) => ({
        url: "/rotation",
        method: "POST",
        body: rotation,
      }),
      invalidatesTags: ["Rotation"],
    }),
    killRotationEntry: builder.mutation<any, KillRotationParams>({
      query: (rotation) => ({
        url: "/rotation",
        method: "PATCH",
        body: rotation,
      }),
      invalidatesTags: ["Rotation"],
    }),
    getInformation: builder.query<AlbumEntry, AlbumRequestParams>({
      query: ({ album_id }) => ({
        url: "/info",
        params: { album_id },
      }),
      transformResponse: (response: AlbumQueryResponse) =>
        convertAlbumFromSearch(response),
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
  useGetRotationQuery,
  useAddRotationEntryMutation,
  useKillRotationEntryMutation,
  useGetInformationQuery,
  useGetFormatsQuery,
  useAddFormatMutation,
  useGetGenresQuery,
  useAddGenreMutation,
} = catalogApi;
