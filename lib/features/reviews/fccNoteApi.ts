import type { FccNote, NewFccNoteRequest } from "@wxyc/shared";
import type { FetchBaseQueryError } from "@reduxjs/toolkit/query";
import { reviewsApi } from "./api";

/**
 * What a rejected FCC note write carries to its caller: the whole rejection,
 * nested under a key the shared rejected-query middleware's
 * `payload.data.message` lookup does not recognize, so the server's message is
 * shown once, inline, and not also toasted. Read it with
 * `unwrapEndpointError("fccNoteWriteError", err)`.
 */
export type FccNoteWriteError = { fccNoteWriteError: FetchBaseQueryError };

const wrapFccNoteWriteError = (response: FetchBaseQueryError): FccNoteWriteError => ({
  fccNoteWriteError: response,
});

/** The `fcc-notes` endpoints. */
export const fccNoteApi = reviewsApi.injectEndpoints({
  endpoints: (builder) => ({
    // Notes in both states; the panel orders them.
    getFccNotes: builder.query<FccNote[], { album_id: number } | { intake_item_id: number }>({
      query: (params) => ({ url: "fcc-notes", params }),
      providesTags: ["FccNotes"],
    }),
    reportFccNote: builder.mutation<FccNote, NewFccNoteRequest>({
      query: (body) => ({ url: "fcc-notes", method: "POST", body }),
      transformErrorResponse: wrapFccNoteWriteError,
      invalidatesTags: ["FccNotes"],
    }),
  }),
});

export const { useGetFccNotesQuery, useReportFccNoteMutation } = fccNoteApi;
