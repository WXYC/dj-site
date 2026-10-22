import type { FeatureAccessEntry, FeatureAccessResponse } from "@wxyc/shared";
import { createApi } from "@reduxjs/toolkit/query/react";
import type { FetchBaseQueryError } from "@reduxjs/toolkit/query";
import { backendBaseQuery } from "../backend";

/**
 * Who may see the features the Backend gates, from `GET /feature-access` on the Backend root. Its own API rather than a
 * route of the reviews API: a read of it is not a review read, and the reviews screens wait on that API's in-flight
 * requests to settle.
 */
export const featureAccessApi = createApi({
  reducerPath: "featureAccessApi",
  baseQuery: backendBaseQuery("", { surfaceNonJsonAsError: true }),
  endpoints: (builder) => ({
    // The Backend serves this `private, no-store`, and the contract has a client read it per page load. An entry that
    // outlives its last subscriber would answer the next screen with an old audience, so none is kept; a subscriber
    // that mounts while another still holds the entry asks again with `refetchOnMountOrArgChange` (see
    // `useCanSeeReviews`).
    getReviewsAccess: builder.query<FeatureAccessEntry, void>({
      query: () => ({ url: "feature-access" }),
      transformResponse: (response: FeatureAccessResponse) => response.reviews,
      keepUnusedDataFor: 0,
      // A failed read is an answer, not an event: the screens stay hidden, as they do for a refusal. Marked expected so the
      // shared error logger neither toasts it on every mount nor reports it.
      transformErrorResponse: (response: FetchBaseQueryError) => ({ ...response, expected: true }),
    }),
  }),
});

export const { useGetReviewsAccessQuery } = featureAccessApi;
