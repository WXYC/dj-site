import type {
  NewReviewRequest,
  Review,
  ReviewConflictReason,
  ReviewPatch,
  ReviewRevision,
  Reviewer,
} from "@wxyc/shared";
import type { FetchBaseQueryError } from "@reduxjs/toolkit/query";
import { isRefusal, isStatusRefusal } from "@/lib/rtk-endpoint-error";
import { intakeApi } from "./intakeApi";
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

/** True when a delete was refused because the review is on the cover of a filed or finalized record. */
export const isReviewAccepted = (err: unknown): boolean =>
  isRefusal(err, { status: 409, reasons: ["accepted_review"] satisfies ReviewConflictReason[], key: "reviewWriteError" });

/**
 * True when a create that linked an account (`author_user_id`) was refused with a 400.
 * Status-only on purpose: every 400 `POST /reviews` answers is a plain `{ message }` with no `reason`,
 * so the body cannot tell this one apart; the request can, because the form stops every other cause
 * of a 400 before it sends. `linked` is whether the request carried an account.
 */
export const isReviewAccountGone = (err: unknown, linked: boolean): boolean =>
  linked && isStatusRefusal(err, { status: 400, key: "reviewWriteError" });

/** The `reviews/...` endpoints. */
export const reviewApi = reviewsApi.injectEndpoints({
  endpoints: (builder) => ({
    // The accounts that can be asked to review, for a picker. `name` is a real name: never send it to telemetry.
    getReviewers: builder.query<Reviewer[], void>({
      query: () => ({ url: "reviews/reviewers" }),
      transformResponse: (response: { reviewers: Reviewer[] }) => response.reviewers,
    }),
    getMyReviews: builder.query<Review[], void>({
      query: () => ({ url: "reviews", params: { mine: true } }),
      providesTags: [{ type: "Review", id: "LIST" }],
    }),
    // The server's order is the panel's order: reviews on the cover first, then the rest.
    getReviewsForRelease: builder.query<Review[], number>({
      query: (albumId) => ({ url: "reviews", params: { album_id: albumId } }),
      providesTags: [{ type: "Review", id: "LIST" }],
    }),
    // Tagged by its item, not as a list: deleting the item must not refetch its own reviews.
    getItemReviews: builder.query<Review[], number>({
      query: (itemId) => ({ url: "reviews", params: { intake_item_id: itemId } }),
      providesTags: (_result, _error, itemId) => [{ type: "Review", id: `item-${itemId}` }],
    }),
    getReview: builder.query<Review, number>({
      query: (id) => ({ url: `reviews/${id}` }),
      providesTags: ["Review"],
    }),
    getReviewRevisions: builder.query<ReviewRevision[], number>({
      query: (id) => ({ url: `reviews/${id}/revisions` }),
      providesTags: ["Review"],
    }),
    createReview: builder.mutation<Review, NewReviewRequest>({
      query: (body) => ({ url: "reviews", method: "POST", body }),
      transformErrorResponse: wrapReviewWriteError,
      invalidatesTags: ["Intake", "Review"],
      // A submitted review that answers with an item was created already accepted for it, whatever the request said
      // (only an on-behalf or handwritten create is accepted by default). Writing that into the cache keeps the
      // cover on the page when the rereads that follow fail: the item's cover, and the review in its list so the page never reads it by id.
      async onQueryStarted(_arg, { dispatch, queryFulfilled }): Promise<void> {
        try {
          const { data: made } = await queryFulfilled;
          if (made.status !== "submitted" || made.intake_item_id == null) return;
          const itemId = made.intake_item_id;
          dispatch(intakeApi.util.updateQueryData("getIntakeItem", itemId, (item) => { item.accepted_review_id = made.id; }));
          dispatch(reviewApi.util.updateQueryData("getItemReviews", itemId, (list) => { if (!list.some((r) => r.id === made.id)) list.push(made); }));
        } catch {
          // A rejection is the caller's `.unwrap()` to surface.
        }
      },
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
  useGetReviewersQuery,
  useGetMyReviewsQuery,
  useGetReviewsForReleaseQuery,
  useGetItemReviewsQuery,
  useGetReviewQuery,
  useGetReviewRevisionsQuery,
  useCreateReviewMutation,
  useUpdateReviewMutation,
  useSubmitReviewMutation,
  useDeleteReviewMutation,
} = reviewApi;
