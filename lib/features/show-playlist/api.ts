import { createApi } from "@reduxjs/toolkit/query/react";
import type { FetchBaseQueryError } from "@reduxjs/toolkit/query";
import { backendBaseQuery } from "../backend";
import type {
  FlowsheetSwitchParams,
  FlowsheetUpdateParams,
} from "@/lib/features/flowsheet/types";
import { EMPTY_SHOW_PLAYLIST, type ShowPlaylistWire } from "./types";

export const CLOSED_SHOW_SENTENCE =
  "Only a music director or station manager can change a show that has ended. Ask one of them to make this change.";
export const NOT_ON_SHOW_SENTENCE =
  "The DJ site can't change this row: it belongs to a show on the air that you are not on.";

export type RefusalOptions<Arg = unknown> = {
  /** Words every 400; a function reads the mutation's argument. Omit to leave a 400 to general handling. */
  badRequest?: string | ((arg: Arg) => string | undefined);
  /** More 403 `code`s the caller words itself; `closed_show` is always worded. */
  codes?: Record<string, string>;
};

/**
 * The one sentence a refused write is shown as, or null when the refusal
 * belongs to the site's general handling. A 403 is told apart by the `code` in
 * its raw body, since a missing permission or a ban is also a 403; a 400 is
 * told apart by its status alone, never its message text, and is worded by the
 * caller.
 */
export function refusalSentence(
  error: { status?: unknown; data?: unknown },
  badRequest?: string,
  codes: Record<string, string> = {}
): string | null {
  if (error.status === 400) {
    return badRequest ?? null;
  }
  if (error.status !== 403) {
    return null;
  }
  const code = (error.data as { code?: unknown } | null | undefined)?.code;
  if (typeof code !== "string") {
    return null;
  }
  return { closed_show: CLOSED_SHOW_SENTENCE, ...codes }[code] ?? null;
}

// A refusal the caller words itself is marked expected, so the global error
// toast stays quiet instead of repeating it in the server's words.
export const markRefusal =
  <Arg>({ badRequest, codes }: RefusalOptions<Arg> = {}) =>
  (error: FetchBaseQueryError, _meta: unknown, arg: Arg) => {
    const sentence = refusalSentence(
      error,
      typeof badRequest === "function" ? badRequest(arg) : badRequest,
      codes
    );
    return sentence ? { ...error, expected: true, sentence } : error;
  };

const markPastShowRefusal = markRefusal({ badRequest: NOT_ON_SHOW_SENTENCE });

export const showPlaylistApi = createApi({
  reducerPath: "showPlaylistApi",
  baseQuery: backendBaseQuery("flowsheet"),
  tagTypes: ["ShowPlaylist"],
  endpoints: (builder) => ({
    getShowPlaylist: builder.query<ShowPlaylistWire, { showId: number }>({
      query: ({ showId }) => ({
        url: "/playlist",
        params: { show_id: showId },
      }),
      // An archived show changes only when a manager fixes a row, and that
      // invalidates this tag, so a revisit within the window is served from
      // cache rather than refetched.
      keepUnusedDataFor: 600,
      providesTags: (_result, _error, { showId }) => [
        { type: "ShowPlaylist", id: showId },
      ],
      // The shared base query soft-fails an unparseable body to null, so a
      // transform that assumes a parsed body throws on exactly the responses
      // that soft-fail exists to absorb.
      transformResponse: (response: ShowPlaylistWire | null) =>
        response ?? EMPTY_SHOW_PLAYLIST,
    }),
    // These reuse the live flowsheet's write routes but none of its cache
    // patching: the row being changed belongs to a show the live entries
    // query does not hold, so the show's own query is refetched instead.
    updateShowEntry: builder.mutation<
      void,
      { showId: number } & FlowsheetUpdateParams
    >({
      query: ({ entry_id, data }) => ({
        url: "/",
        method: "PATCH",
        body: { entry_id, data },
      }),
      transformErrorResponse: markPastShowRefusal,
      invalidatesTags: (_result, _error, { showId }) => [
        { type: "ShowPlaylist", id: showId },
      ],
    }),
    removeShowEntry: builder.mutation<
      void,
      { showId: number; entry_id: number }
    >({
      query: ({ entry_id }) => ({
        url: "/",
        method: "DELETE",
        body: { entry_id },
      }),
      transformErrorResponse: markPastShowRefusal,
      invalidatesTags: (_result, _error, { showId }) => [
        { type: "ShowPlaylist", id: showId },
      ],
    }),
    reorderShowEntry: builder.mutation<
      void,
      { showId: number } & FlowsheetSwitchParams
    >({
      query: ({ entry_id, new_position }) => ({
        url: "/play-order",
        method: "PATCH",
        body: { entry_id, new_position },
      }),
      transformErrorResponse: markPastShowRefusal,
      invalidatesTags: (_result, _error, { showId }) => [
        { type: "ShowPlaylist", id: showId },
      ],
    }),
  }),
});

export const {
  useGetShowPlaylistQuery,
  useUpdateShowEntryMutation,
  useRemoveShowEntryMutation,
  useReorderShowEntryMutation,
} = showPlaylistApi;
