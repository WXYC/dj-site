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
  tagTypes: ["Rotation"],
  endpoints: (builder) => ({
    searchCatalog: builder.query<AlbumEntry[], SearchCatalogQueryParams>({
      query: ({ artist_name, album_name, n }) => ({
        url: "/",
        params: { artist_name, album_name, n },
      }),
      transformResponse: (response: AlbumSearchResultJSON[]) =>
        response.map(convertToAlbumEntry),
    }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- backend response type not defined
    addAlbum: builder.mutation<any, AlbumParams>({
      query: (album) => ({
        url: "/",
        method: "POST",
        body: album,
      }),
    }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- backend response type not defined
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
    }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- backend response type not defined
    getFormats: builder.query<any, void>({
      query: () => ({
        url: "/formats",
      }),
    }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- backend response type not defined
    addFormat: builder.mutation<any, string>({
      query: (format) => ({
        url: "/formats",
        method: "POST",
        body: format,
      }),
    }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- backend response type not defined
    getGenres: builder.query<any, void>({
      query: () => ({
        url: "/genres",
      }),
    }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- backend response type not defined
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
} = catalogApi;
