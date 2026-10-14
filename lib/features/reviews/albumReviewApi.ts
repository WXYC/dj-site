import type {
  AlbumReview,
  AlbumReviewsResponse,
} from "@wxyc/shared";
import { reviewsApi } from "./api";

/** The `album-reviews` endpoints. */
export const albumReviewApi = reviewsApi.injectEndpoints({
  endpoints: (builder) => ({
    // The Google Form archive, read-only. After the form closes, linked rows are copied into `Review` once, and this list
    // leaves a row out while its copy exists.
    getAlbumReviewsForRelease: builder.query<AlbumReview[], number>({
      query: (albumId) => ({ url: "album-reviews", params: { album_id: albumId } }),
      transformResponse: (response: AlbumReviewsResponse) => response.album_reviews,
    }),
    // The archive's rows for one exact artist name, for an in-flight record that is not in the library yet.
    getAlbumReviewsByArtist: builder.query<AlbumReview[], string>({
      query: (artist) => ({ url: "album-reviews", params: { artist } }),
      transformResponse: (response: AlbumReviewsResponse) => response.album_reviews,
    }),
  }),
});

export const { useGetAlbumReviewsForReleaseQuery, useGetAlbumReviewsByArtistQuery } = albumReviewApi;
