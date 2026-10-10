import type {
  IntakeDeleteResponse,
  IntakeFileRequest,
  IntakeItem,
  IntakeItemState,
  IntakeSlip,
  NewIntakeItemRequest,
} from "@wxyc/shared";
import type { FetchBaseQueryError } from "@reduxjs/toolkit/query";
import { catalogApi, FILING_INVALIDATED_TAGS } from "@/lib/features/catalog/api";
import { rotationApi } from "@/lib/features/rotation/api";
import { isRefusal, isStatusRefusal } from "@/lib/rtk-endpoint-error";
import { reviewsApi } from "./api";

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

// Intake refusal predicates live here, so a screen reads a rejected intake write
// one way. Each is one `isRefusal` call, except a refusal whose server body
// carries no `reason`: `isRefusal` can never match that, so it is one
// `isStatusRefusal` call, and only on a write whose form cannot send any other 400.

/** True when an intake write lost its race: someone else got there first, or the request expired. */
export const isIntakeStateChanged = (err: unknown): boolean =>
  isRefusal(err, { status: 409, reasons: ["state_changed"], key: "intakeWriteError" });

/**
 * True when a write was refused with `not_reviewed`: filing, because the review chosen for the cover was removed;
 * or printing the slip, because no review is on the cover or the one there is handwritten.
 */
export const isIntakeNotReviewed = (err: unknown): boolean =>
  isRefusal(err, { status: 409, reasons: ["not_reviewed"], key: "intakeWriteError" });

/** True when a delete lost its race to a filing: the record is already filed (409 `already_filed`). */
export const isIntakeAlreadyFiled = (err: unknown): boolean =>
  isRefusal(err, { status: 409, reasons: ["already_filed"], key: "intakeWriteError" });

/** True when finalizing was refused because the release is in active rotation. */
export const isIntakeInRotation = (err: unknown): boolean =>
  isRefusal(err, { status: 409, reasons: ["in_rotation"], key: "intakeWriteError" });

/**
 * True when filing onto an existing release was refused because `album_id` names no library release (400).
 * That 400 has no `reason` (the server throws a plain error), so it is matched by status alone; the page
 * sends nothing else the route could refuse with a 400.
 */
export const isIntakeReleaseRefused = (err: unknown): boolean =>
  isStatusRefusal(err, { status: 400, key: "intakeWriteError" });

/**
 * True when a request was refused (400) because the chosen account was removed or is no longer a DJ.
 * That 400 has no `reason` (the server throws a plain error), so it is matched by status alone; the
 * request button is disabled until an account is picked, so the route's other 400 cannot arrive.
 */
export const isIntakeRequestRefused = (err: unknown): boolean =>
  isStatusRefusal(err, { status: 400, key: "intakeWriteError" });

/**
 * True when "Use this review" was refused (400) because the review is still a draft or belongs to another
 * record. That 400 has no `reason` (the server throws a plain error), so it is matched by status alone; the
 * button always sends `review_id`, so the route's other 400 (`review_id is required`) cannot arrive. Read it
 * only in that button's rejection handler: the same status means something else on every other intake write.
 */
export const isIntakeAcceptReviewRefused = (err: unknown): boolean =>
  isStatusRefusal(err, { status: 400, key: "intakeWriteError" });

/** The `intake/...` endpoints. */
export const intakeApi = reviewsApi.injectEndpoints({
  endpoints: (builder) => ({
    getIntakeItems: builder.query<IntakeItem[], { state?: IntakeItemState; awaiting_acceptance?: boolean } | void>({
      query: (args) => {
        const params = {
          ...(args && args.state ? { state: args.state } : {}),
          ...(args && args.awaiting_acceptance ? { awaiting_acceptance: true } : {}),
        };
        // An empty params object still serializes to a dangling `?`.
        return { url: "intake", ...(Object.keys(params).length > 0 && { params }) };
      },
      providesTags: [{ type: "Intake", id: "LIST" }],
    }),
    logIntakeItem: builder.mutation<IntakeItem, NewIntakeItemRequest>({
      query: (body) => ({ url: "intake", method: "POST", body }),
      invalidatesTags: ["Intake"],
    }),
    getIntakeItem: builder.query<IntakeItem, number>({
      query: (id) => ({ url: `intake/${id}` }),
      providesTags: (_result, _error, id) => [{ type: "Intake", id }],
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
    // A music director asking a DJ to review a record on the review shelf.
    requestIntakeItem: builder.mutation<IntakeItem, { id: number; djId: string }>({
      query: ({ id, djId }) => ({ url: `intake/${id}/request`, method: "POST", body: { dj_id: djId } }),
      transformErrorResponse: wrapIntakeWriteError,
      invalidatesTags: ["Intake"],
    }),
    cancelIntakeRequest: builder.mutation<IntakeItem, number>({
      query: (id) => ({ url: `intake/${id}/cancel-request`, method: "POST" }),
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
    // A music director choosing the review that goes on the cover. Unrelated to the requested DJ
    // saying yes to a request (`acceptIntakeItem`, `POST intake/{id}/accept`). Works at every state,
    // which is how a review is replaced.
    acceptReview: builder.mutation<IntakeItem, { id: number; reviewId: number }>({
      query: ({ id, reviewId }) => ({ url: `intake/${id}/accept-review`, method: "POST", body: { review_id: reviewId } }),
      transformErrorResponse: wrapIntakeWriteError,
      invalidatesTags: ["Intake", "Review"],
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
    // Every call is recorded in the print log, so a caller sends it on a press, never on load.
    printIntakeItem: builder.mutation<IntakeSlip, number>({
      query: (id) => ({ url: `intake/${id}/print`, method: "POST" }),
      transformErrorResponse: wrapIntakeWriteError,
      invalidatesTags: ["Intake", "Review"],
    }),
    // Takes the item's reviews and unsubmitted drafts with it; the response names their authors.
    // Refreshes the lists only: the deleted record's own reads (`getIntakeItem(id)`,
    // `getItemReviews(id)`) are not invalidated, because a refetch would 404 and the
    // shared error logger would toast and report it. The record's FCC notes go with it, so a
    // waiting list kept in cache is dropped rather than served with the deleted record's note.
    deleteIntakeItem: builder.mutation<IntakeDeleteResponse, number>({
      query: (id) => ({ url: `intake/${id}`, method: "DELETE" }),
      transformErrorResponse: wrapIntakeWriteError,
      invalidatesTags: [
        { type: "Intake", id: "LIST" },
        { type: "Review", id: "LIST" },
        "FccNotes",
      ],
    }),
    // Files a library row and, on the rotation arm, a rotation row. Those caches
    // live in other `createApi` instances, whose tags `invalidatesTags` cannot reach.
    fileIntakeItem: builder.mutation<IntakeItem, { id: number; body: IntakeFileRequest }>({
      query: ({ id, body }) => ({ url: `intake/${id}/file`, method: "POST", body }),
      transformErrorResponse: wrapIntakeWriteError,
      // Filing onto an existing release stamps that release's `album_id` on the record's reviews, prints and
      // FCC notes, so the release's review list, the record's own reviews and the FCC notes are stale once it
      // succeeds. A rejection changed none of that and refreshes only the record.
      invalidatesTags: (_result, error, { id, body }) =>
        error || body.kind !== "existing_release"
          ? ["Intake"]
          : ["Intake", { type: "Review", id: "LIST" }, { type: "Review", id: `item-${id}` }, "FccNotes"],
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        try {
          await queryFulfilled;
          dispatch(catalogApi.util.invalidateTags(FILING_INVALIDATED_TAGS));
          dispatch(rotationApi.util.invalidateTags(["Rotation"]));
        } catch {
          // A rejection is the caller's `.unwrap()` to surface.
        }
      },
    }),
  }),
});

export const {
  useGetIntakeItemsQuery,
  useGetIntakeItemQuery,
  useLogIntakeItemMutation,
  useCheckoutIntakeItemMutation,
  useReleaseIntakeItemMutation,
  useRequestIntakeItemMutation,
  useCancelIntakeRequestMutation,
  useAcceptIntakeItemMutation,
  useAcceptReviewMutation,
  usePassIntakeItemMutation,
  useFinalizeIntakeItemMutation,
  useFileIntakeItemMutation,
  usePrintIntakeItemMutation,
  useDeleteIntakeItemMutation,
} = intakeApi;
