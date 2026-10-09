import type {
  NewReviewRequest,
  Review,
  ReviewConflictReason,
  ReviewPatch,
} from "@wxyc/shared";
import type { FetchBaseQueryError } from "@reduxjs/toolkit/query";
import { isRefusal } from "@/lib/rtk-endpoint-error";
import { reviewsApi } from "./api";

/** The review writes' counterpart of `IntakeWriteError`, nested under its own key for the same reason. */
export type ReviewWriteError = { reviewWriteError: FetchBaseQueryError };

const wrapReviewWriteError = (response: FetchBaseQueryError): ReviewWriteError => ({
  reviewWriteError: response,
});

/** True when starting a draft was refused because the DJ no longer holds the record. */
export const isReviewSubjectNotHeld = (err: unknown): boolean =>
  isRefusal(err, { status: 409, reasons: ["subject_not_held"], key: "reviewWriteError" });

/** True when a submit found the review already submitted. */
export const isReviewNotDraft = (err: unknown): boolean =>
  isRefusal(err, { status: 409, reasons: ["not_draft"] satisfies ReviewConflictReason[], key: "reviewWriteError" });

/** True when a delete was refused because a music director is using the review as the record's review. */
export const isReviewInUse = (err: unknown): boolean =>
  isRefusal(err, { status: 409, reasons: ["in_use"] satisfies ReviewConflictReason[], key: "reviewWriteError" });

/** The `reviews/...` endpoints. */
export const reviewApi = reviewsApi.injectEndpoints({
  endpoints: (builder) => ({
    getMyReviews: builder.query<Review[], void>({
      query: () => ({ url: "reviews", params: { mine: true } }),
      providesTags: ["Review"],
    }),
    // The server's order is the panel's order: reviews on the cover first, then the rest.
    getReviewsForRelease: builder.query<Review[], number>({
      query: (albumId) => ({ url: "reviews", params: { album_id: albumId } }),
      providesTags: ["Review"],
    }),
    getItemReviews: builder.query<Review[], number>({
      query: (itemId) => ({ url: "reviews", params: { intake_item_id: itemId } }),
      providesTags: ["Review"],
    }),
    getReview: builder.query<Review, number>({
      query: (id) => ({ url: `reviews/${id}` }),
      providesTags: ["Review"],
    }),
    createReview: builder.mutation<Review, NewReviewRequest>({
      query: (body) => ({ url: "reviews", method: "POST", body }),
      transformErrorResponse: wrapReviewWriteError,
      invalidatesTags: ["Intake", "Review"],
    }),
    updateReview: builder.mutation<Review, { id: number; patch: ReviewPatch }>({
      query: ({ id, patch }) => ({ url: `reviews/${id}`, method: "PATCH", body: patch }),
      transformErrorResponse: wrapReviewWriteError,
      invalidatesTags: ["Review"],
    }),
    submitReview: builder.mutation<Review, number>({
      query: (id) => ({ url: `reviews/${id}/submit`, method: "POST" }),
      transformErrorResponse: wrapReviewWriteError,
      // A submit changes the item's submitted_review_count and its Review waiting membership.
      invalidatesTags: ["Intake", "Review"],
    }),
    deleteReview: builder.mutation<void, number>({
      query: (id) => ({ url: `reviews/${id}`, method: "DELETE" }),
      transformErrorResponse: wrapReviewWriteError,
      invalidatesTags: ["Intake", "Review"],
    }),
  }),
});

export const {
  useGetMyReviewsQuery,
  useGetReviewsForReleaseQuery,
  useGetItemReviewsQuery,
  useGetReviewQuery,
  useLazyGetReviewQuery,
  useCreateReviewMutation,
  useUpdateReviewMutation,
  useSubmitReviewMutation,
  useDeleteReviewMutation,
} = reviewApi;
