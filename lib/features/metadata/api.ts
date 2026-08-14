import { createApi } from "@reduxjs/toolkit/query/react";
import { backendBaseQuery } from "../backend";
import {
  AlbumMetadata,
  AlbumMetadataQueryParams,
  ArtistMetadata,
  LibraryTracksResponse,
} from "./types";

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
    /**
     * Tracklist for a release, for the flowsheet track picker.
     *
     * **The argument is a `legacy_release_id`, not a `library.id`** — the two
     * are different id spaces over the same row. Backend resolves this path
     * param with `getDiscogsReleaseIdByLegacyId`, which filters on
     * `library.legacy_release_id`; the URL segment is named `libraryId` there
     * for historical reasons and means the same thing it does here.
     *
     * Passing a `library.id` does not fail loudly. The two spaces are nearly
     * coextensive, so the lookup lands on a real but unrelated release and
     * returns its tracklist with a 200. Getting this argument right is the
     * whole point of the field's existence.
     *
     * The argument is also this endpoint's RTK Query cache key, so every
     * caller — the hover prefetch and the picker query alike — has to agree on
     * the id space or they warm and read different cache entries.
     *
     * Backend rejects a non-positive value with a 400, so callers gate on real
     * linkage rather than passing a placeholder.
     */
    getLibraryTracks: builder.query<LibraryTracksResponse, number>({
      query: (legacyReleaseId) => ({
        url: `/library/${legacyReleaseId}/tracks`,
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
