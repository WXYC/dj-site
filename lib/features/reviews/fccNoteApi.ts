import type { FccNote, NewFccNoteRequest } from "@wxyc/shared";
import type { FetchBaseQueryError } from "@reduxjs/toolkit/query";
import { isStatusRefusal } from "@/lib/rtk-endpoint-error";
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

// Refusal predicates. None of these bodies carries a `reason` (the server answers each with a
// plain error), so each is matched by status alone: the write that reads it sends nothing else
// the route could refuse with that status. The two 403 predicates share a status and a key and
// differ only in what the screen does, so each is read only in its own write's rejection handler.

/** True when a report was refused as malformed (400): the server's message is written for a DJ to read. */
export const isFccNoteInvalid = (err: unknown): boolean =>
  isStatusRefusal(err, { status: 400, key: "fccNoteWriteError" });

/** True when a report or a confirm was refused (403) because the account behind the token has no name to stamp: it was removed. */
export const isFccNoteAccountRemoved = (err: unknown): boolean =>
  isStatusRefusal(err, { status: 403, key: "fccNoteWriteError" });

/** True when the reporter's take-back was refused (403): a music director confirmed the note first. */
export const isFccNoteTakeBackRefused = (err: unknown): boolean =>
  isStatusRefusal(err, { status: 403, key: "fccNoteWriteError" });

/** True when a confirm or a remove found the note already gone (404). */
export const isFccNoteGone = (err: unknown): boolean =>
  isStatusRefusal(err, { status: 404, key: "fccNoteWriteError" });

/** The `fcc-notes` endpoints. */
export const fccNoteApi = reviewsApi.injectEndpoints({
  endpoints: (builder) => ({
    // Notes in both states; the panel orders them.
    getFccNotes: builder.query<FccNote[], { album_id: number } | { intake_item_id: number }>({
      query: (params) => ({ url: "fcc-notes", params }),
      providesTags: ["FccNotes"],
    }),
    // Every unconfirmed note with its record's artist and album; music directors only.
    getFccNotesToConfirm: builder.query<FccNote[], void>({
      query: () => ({ url: "fcc-notes", params: { status: "reported" } }),
      providesTags: ["FccNotes"],
    }),
    reportFccNote: builder.mutation<FccNote, NewFccNoteRequest>({
      query: (body) => ({ url: "fcc-notes", method: "POST", body }),
      transformErrorResponse: wrapFccNoteWriteError,
      invalidatesTags: ["FccNotes"],
    }),
    // One untyped tag refreshes every panel and the waiting list, whichever subject each reads;
    // a rejected write invalidates too, so a lost race reloads the lists.
    confirmFccNote: builder.mutation<FccNote, number>({
      query: (id) => ({ url: `fcc-notes/${id}/confirm`, method: "POST" }),
      transformErrorResponse: wrapFccNoteWriteError,
      invalidatesTags: ["FccNotes"],
    }),
    deleteFccNote: builder.mutation<unknown, number>({
      query: (id) => ({ url: `fcc-notes/${id}`, method: "DELETE" }),
      transformErrorResponse: wrapFccNoteWriteError,
      invalidatesTags: ["FccNotes"],
    }),
  }),
});

export const {
  useGetFccNotesQuery,
  useGetFccNotesToConfirmQuery,
  useReportFccNoteMutation,
  useConfirmFccNoteMutation,
  useDeleteFccNoteMutation,
} = fccNoteApi;
