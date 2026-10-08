import type {
  AlbumReview,
  AlbumReviewsResponse,
} from "@wxyc/shared";
import { reviewsApi } from "./api";

/** The `album-reviews` endpoints. */
export const albumReviewApi = reviewsApi.injectEndpoints({
  endpoints: (builder) => ({
    // The Google Form archive: read-only earlier takes, never merged into `Review`.
    getAlbumReviewsForRelease: builder.query<AlbumReview[], number>({
      query: (albumId) => ({ url: "album-reviews", params: { album_id: albumId } }),
      transformResponse: (response: AlbumReviewsResponse) => response.album_reviews,
    }),
  }),
});

export const { useGetAlbumReviewsForReleaseQuery } = albumReviewApi;
