import type { FetchBaseQueryError } from "@reduxjs/toolkit/query";
import type { IntakeSlip, LibraryPrintRequest } from "@wxyc/shared";
import { unwrapEndpointError } from "@/lib/rtk-endpoint-error";
import { reviewsApi } from "./api";

/**
 * What a rejected library print carries to its caller: the whole rejection,
 * nested under a key the shared rejected-query middleware's
 * `payload.data.message` lookup does not recognize, so the server's message
 * (which names a request field) is never toasted over the screen's own line.
 */
export type LibraryPrintError = { libraryPrintError: FetchBaseQueryError };

const wrapLibraryPrintError = (response: FetchBaseQueryError): LibraryPrintError => ({
  libraryPrintError: response,
});

/**
 * True when the print was refused because the review is handwritten, a draft,
 * or not this release's. That 400 has no `reason` (the server throws a plain
 * error), so it is matched by status alone; the page always sends the
 * `review_id` it was opened with, so the route's other 400 cannot arrive.
 */
export const isLibraryPrintRefused = (err: unknown): boolean =>
  unwrapEndpointError("libraryPrintError", err)?.status === 400;

/** The `library/...` endpoints of the reviews API. */
export const libraryApi = reviewsApi.injectEndpoints({
  endpoints: (builder) => ({
    // Every call is recorded in the print log, so a caller sends it on a press, never on load.
    printReleaseReview: builder.mutation<IntakeSlip, { albumId: number; reviewId: number }>({
      query: ({ albumId, reviewId }) => ({
        url: `library/${albumId}/print`,
        method: "POST",
        body: { review_id: reviewId } satisfies LibraryPrintRequest,
      }),
      transformErrorResponse: wrapLibraryPrintError,
      invalidatesTags: ["Review"],
    }),
  }),
});

export const { usePrintReleaseReviewMutation } = libraryApi;
