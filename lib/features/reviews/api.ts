import { createApi } from "@reduxjs/toolkit/query/react";
import type { IntakeItem, IntakeItemState } from "@wxyc/shared";
import type { FetchBaseQueryError } from "@reduxjs/toolkit/query";
import { backendBaseQuery } from "../backend";

/**
 * What a rejected intake write carries to its caller. The global error toast
 * speaks the server's `message` for any rejection it recognizes, but a screen
 * here words its own refusal, and a lost race (409 `state_changed`) is not an
 * error at all; this shape carries neither a `status` nor a message, so the
 * toast stays quiet.
 */
export type IntakeWriteError = { intakeWriteError: { stateChanged: boolean } };

const wrapIntakeWriteError = (response: FetchBaseQueryError): IntakeWriteError => ({
  intakeWriteError: {
    stateChanged:
      response.status === 409 &&
      (response.data as { reason?: unknown } | undefined)?.reason === "state_changed",
  },
});

/** True when an intake write lost its race: someone else got there first, or the request expired. */
export const isIntakeStateChanged = (err: unknown): boolean =>
  (err as Partial<IntakeWriteError> | null)?.intakeWriteError?.stateChanged === true;

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
  tagTypes: ["Intake"],
  endpoints: (builder) => ({
    getIntakeItems: builder.query<IntakeItem[], { state?: IntakeItemState } | void>({
      query: (args) => ({
        url: "intake",
        params: args && args.state ? { state: args.state } : undefined,
      }),
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
  }),
});

export const {
  useGetIntakeItemsQuery,
  useCheckoutIntakeItemMutation,
  useReleaseIntakeItemMutation,
  useAcceptIntakeItemMutation,
  usePassIntakeItemMutation,
} = reviewsApi;
