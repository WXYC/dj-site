import { createApi } from "@reduxjs/toolkit/query/react";
import type { IntakeItem, IntakeItemState, NewReviewRequest, Review, ReviewPatch } from "@wxyc/shared";
import type { FetchBaseQueryError } from "@reduxjs/toolkit/query";
import { backendBaseQuery } from "../backend";
import { isRefusal } from "@/lib/rtk-endpoint-error";

/**
 * What a rejected intake write carries to its caller: the whole rejection,
 * nested under a key the shared rejected-query middleware's
 * `payload.data.message` lookup does not recognize. A screen here words its own
 * refusal, and a lost race (409 `state_changed`) is not an error at all, so the
 * middleware must not toast the server's message over it. Read it with
 * `unwrapEndpointError("intakeWriteError", err)`.
 */
export type IntakeWriteError = { intakeWriteError: FetchBaseQueryError };

const wrapIntakeWriteError = (response: FetchBaseQueryError): IntakeWriteError => ({
  intakeWriteError: response,
});

// Intake refusal predicates live here, one `isRefusal` call each, so a screen
// reads a rejected intake write one way.

/** True when an intake write lost its race: someone else got there first, or the request expired. */
export const isIntakeStateChanged = (err: unknown): boolean =>
  isRefusal(err, { status: 409, reasons: ["state_changed"], key: "intakeWriteError" });

/** True when finalizing was refused because the release is in active rotation. */
export const isIntakeInRotation = (err: unknown): boolean =>
  isRefusal(err, { status: 409, reasons: ["in_rotation"], key: "intakeWriteError" });

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
  isRefusal(err, { status: 409, reasons: ["not_draft"], key: "reviewWriteError" });

/** True when a delete was refused because a music director is using the review as the record's review. */
export const isReviewInUse = (err: unknown): boolean =>
  isRefusal(err, { status: 409, reasons: ["in_use"], key: "reviewWriteError" });

/**
 * Rooted at the Backend-Service root, not at one domain: every endpoint's `url`
 * carries its own (`intake/...`, `reviews/...`, `fcc-notes...`). Review
 * mutations invalidate tags across those domains, and RTK Query tags do not
 * cross `createApi` instances, so they all live in this one API. Every read
 * fails loudly on a non-JSON body: each has an empty state that states a fact,
 * which an outage must never be mistaken for.
 */
export const reviewsApi = createApi({
  reducerPath: "reviewsApi",
  baseQuery: backendBaseQuery("", { surfaceNonJsonAsError: true }),
  tagTypes: ["Intake", "Review"],
  endpoints: (builder) => ({
    getIntakeItems: builder.query<IntakeItem[], { state?: IntakeItemState } | void>({
      query: (args) => ({
        url: "intake",
        params: args && args.state ? { state: args.state } : undefined,
      }),
      providesTags: ["Intake"],
    }),
    getIntakeItem: builder.query<IntakeItem, number>({
      query: (id) => ({ url: `intake/${id}` }),
      providesTags: ["Intake"],
    }),
    checkoutIntakeItem: builder.mutation<IntakeItem, number>({
      query: (id) => ({ url: `intake/${id}/checkout`, method: "POST" }),
      transformErrorResponse: wrapIntakeWriteError,
      invalidatesTags: ["Intake"],
    }),
    // On a `reviewed` record this clears the holder and leaves it reviewed.
    releaseIntakeItem: builder.mutation<IntakeItem, number>({
      query: (id) => ({ url: `intake/${id}/release`, method: "POST" }),
      transformErrorResponse: wrapIntakeWriteError,
      invalidatesTags: ["Intake"],
    }),
    // The requested DJ saying yes to a music director's request. Unrelated to a
    // music director choosing a review (`POST intake/{id}/accept-review`).
    acceptIntakeItem: builder.mutation<IntakeItem, number>({
      query: (id) => ({ url: `intake/${id}/accept`, method: "POST" }),
      transformErrorResponse: wrapIntakeWriteError,
      invalidatesTags: ["Intake"],
    }),
    passIntakeItem: builder.mutation<IntakeItem, number>({
      query: (id) => ({ url: `intake/${id}/pass`, method: "POST" }),
      transformErrorResponse: wrapIntakeWriteError,
      invalidatesTags: ["Intake"],
    }),
    // The librarian shelving a filed record. Refuses 409 `in_rotation` while
    // the release is in active rotation.
    finalizeIntakeItem: builder.mutation<IntakeItem, number>({
      query: (id) => ({ url: `intake/${id}/finalize`, method: "POST" }),
      transformErrorResponse: wrapIntakeWriteError,
      invalidatesTags: ["Intake"],
    }),
    getMyReviews: builder.query<Review[], void>({
      query: () => ({ url: "reviews", params: { mine: true } }),
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
      invalidatesTags: ["Review"],
    }),
    deleteReview: builder.mutation<void, number>({
      query: (id) => ({ url: `reviews/${id}`, method: "DELETE" }),
      transformErrorResponse: wrapReviewWriteError,
      invalidatesTags: ["Intake", "Review"],
    }),
  }),
});

export const {
  useGetIntakeItemsQuery,
  useGetIntakeItemQuery,
  useCheckoutIntakeItemMutation,
  useReleaseIntakeItemMutation,
  useAcceptIntakeItemMutation,
  usePassIntakeItemMutation,
  useFinalizeIntakeItemMutation,
  useGetMyReviewsQuery,
  useGetReviewQuery,
  useCreateReviewMutation,
  useUpdateReviewMutation,
  useSubmitReviewMutation,
  useDeleteReviewMutation,
} = reviewsApi;
