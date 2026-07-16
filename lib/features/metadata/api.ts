import { createApi } from "@reduxjs/toolkit/query/react";
import { backendBaseQuery } from "../backend";
import { withConditionalGet } from "./conditionalGet";
import {
  AlbumMetadata,
  AlbumMetadataQueryParams,
  ArtistMetadata,
  LibraryTracksResponse,
} from "./types";

export const metadataApi = createApi({
  reducerPath: "metadataApi",
  baseQuery: withConditionalGet(backendBaseQuery("proxy")),
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
    getLibraryTracks: builder.query<LibraryTracksResponse, number>({
      query: (libraryId) => ({
        url: `/library/${libraryId}/tracks`,
      }),
    }),
  }),
});

export const {
  useGetAlbumMetadataQuery,
  useGetArtistMetadataQuery,
  useGetLibraryTracksQuery,
  useLazyGetLibraryTracksQuery,
  usePrefetch: useMetadataPrefetch,
} = metadataApi;
