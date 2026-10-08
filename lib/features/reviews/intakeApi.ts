import type {
  IntakeFileRequest,
  IntakeItem,
  IntakeItemState,
  NewIntakeItemRequest,
} from "@wxyc/shared";
import type { FetchBaseQueryError } from "@reduxjs/toolkit/query";
import { catalogApi, FILING_INVALIDATED_TAGS } from "@/lib/features/catalog/api";
import { rotationApi } from "@/lib/features/rotation/api";
import { isRefusal } from "@/lib/rtk-endpoint-error";
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

// Intake refusal predicates live here, one `isRefusal` call each, so a screen
// reads a rejected intake write one way.

/** True when an intake write lost its race: someone else got there first, or the request expired. */
export const isIntakeStateChanged = (err: unknown): boolean =>
  isRefusal(err, { status: 409, reasons: ["state_changed"], key: "intakeWriteError" });

/** True when filing was refused because the review chosen for the cover was removed. */
export const isIntakeNotReviewed = (err: unknown): boolean =>
  isRefusal(err, { status: 409, reasons: ["not_reviewed"], key: "intakeWriteError" });

/** True when finalizing was refused because the release is in active rotation. */
export const isIntakeInRotation = (err: unknown): boolean =>
  isRefusal(err, { status: 409, reasons: ["in_rotation"], key: "intakeWriteError" });

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
      providesTags: ["Intake"],
    }),
    logIntakeItem: builder.mutation<IntakeItem, NewIntakeItemRequest>({
      query: (body) => ({ url: "intake", method: "POST", body }),
      invalidatesTags: ["Intake"],
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
    // Files a library row and, on the rotation arm, a rotation row. Those caches
    // live in other `createApi` instances, whose tags `invalidatesTags` cannot reach.
    fileIntakeItem: builder.mutation<IntakeItem, { id: number; body: IntakeFileRequest }>({
      query: ({ id, body }) => ({ url: `intake/${id}/file`, method: "POST", body }),
      transformErrorResponse: wrapIntakeWriteError,
      invalidatesTags: ["Intake"],
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
  useAcceptIntakeItemMutation,
  usePassIntakeItemMutation,
  useFinalizeIntakeItemMutation,
  useFileIntakeItemMutation,
} = intakeApi;
