import { createApi } from "@reduxjs/toolkit/query/react";
import { backendBaseQuery } from "../backend";
import { AlbumMetadata, AlbumMetadataQueryParams, ArtistMetadata } from "./types";

export const metadataApi = createApi({
  reducerPath: "metadataApi",
  baseQuery: backendBaseQuery("proxy"),
  endpoints: (builder) => ({
    getAlbumMetadata: builder.query<AlbumMetadata, AlbumMetadataQueryParams>({
      query: ({ artistName, releaseTitle, trackTitle }) => ({
        url: "/metadata/album",
        params: { artistName, releaseTitle, ...(trackTitle && { trackTitle }) },
      }),
    }),
    getArtistMetadata: builder.query<ArtistMetadata, { artistId: number }>({
      query: ({ artistId }) => ({
        url: "/metadata/artist",
        params: { artistId },
      }),
    }),
  }),
});

export const { useGetAlbumMetadataQuery, useGetArtistMetadataQuery } = metadataApi;
