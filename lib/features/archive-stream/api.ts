import { createApi } from "@reduxjs/toolkit/query/react";
import type { FetchBaseQueryError } from "@reduxjs/toolkit/query";
import { backendBaseQuery } from "../backend";
import type { FlowsheetRangeEntry, FlowsheetRangeResponse } from "@wxyc/shared";

export type ArchiveStreamArg = {
  /** How many entries a page holds before its walk stops. The walk never splits
   * a window and a window spans at least a day -- a few hundred rows at the
   * station's usual pace -- so this is a floor, and a page usually runs well
   * past it. The window that reaches the far side of a gap longer than a week
   * can be 8 days wide, so that page can carry a few thousand rows (2,861 and
   * 3.4 MB for the densest recent 8 days). Every page walks at least one
   * window, whatever this is. */
  pageSize: number;
};

/**
 * Where a page's walk starts: an exclusive upper bound in epoch milliseconds,
 * or `"now"`. The head page resolves "now" when it is fetched, so a refetch
 * re-anchors it on the present instead of replaying the moment the listing
 * first opened. Not `null`: RTK reads a nullish page param as "no page".
 */
export type ArchiveStreamCursor = number | "now";

/**
 * `reachedStart` is the only end-of-archive signal. A page short of `pageSize`
 * without it -- even an empty one -- spent `MAX_WINDOWS_PER_PAGE` inside a quiet
 * stretch, and the walk resumes from `nextCursor`.
 */
export type ArchiveStreamPage = {
  /** Newest first by `add_time`, then by `id` -- the reverse of each
   * `/flowsheet/range` window's wire order. Pages also run newest to oldest,
   * so appending each page's entries in page order reads as one unbroken
   * newest-first stream. */
  entries: FlowsheetRangeEntry[];
} & (
  | { reachedStart: true; nextCursor: null }
  | { reachedStart: false; nextCursor: number }
);

const DAY_MS = 24 * 60 * 60 * 1000;

/** The step after a window that turned up rows. */
const MIN_WINDOW_MS = DAY_MS;

/** `/flowsheet/range` rejects a window wider than 8 days (`MAX_RANGE_MS`,
 * Backend-Service `flowsheet.controller.ts`). */
const MAX_WINDOW_MS = 8 * DAY_MS;

/**
 * How far the head page's first window reaches past the device's clock. A
 * clock running behind the server's would otherwise leave the newest rows out
 * of the listing; nothing is logged in the future, so the reach costs nothing.
 */
const CLOCK_SKEW_ALLOWANCE_MS = DAY_MS;

/**
 * The walk ends here, not after some run of empty windows, because the
 * archive has real gaps: no rows at all from 2020-04-01 to 2020-05-12 (41.7
 * days), then weekly shows 6.9 days apart through that summer. Any empty-run
 * bound cheap enough to walk would stop at that gap and hide the fifteen years
 * before it. Per-month counts from 2004-11 through 2026-09 found no other
 * month thin enough to hide a gap of more than a few days.
 *
 * The first row (id 154) was logged the evening of 2004-11-03, station time;
 * neither `/flowsheet/search` in date order nor the id sequence has anything
 * older, and `/flowsheet/range` is empty for the 8 days before this floor,
 * which is the UTC midnight preceding that row. Rows backfilled from before it
 * are unreachable until it moves.
 */
export const ARCHIVE_START_MS = Date.UTC(2004, 10, 4);

/**
 * Most requests one page makes. An empty window doubles the next one's width
 * up to the 8-day cap, so the 41.7-day gap above takes 8 windows to cross;
 * twice that leaves a page room for the rows on either side. It bounds a public
 * page's sequential request count if the backend ever answers every window
 * empty, which would otherwise walk all the way back to `ARCHIVE_START_MS`.
 */
export const MAX_WINDOWS_PER_PAGE = 16;

export const archiveStreamApi = createApi({
  reducerPath: "archiveStreamApi",
  // `/flowsheet/range` is public and the walk sends nothing that depends on
  // identity, so resolving a JWT for it would cost a signed-out visitor an
  // `/auth/token` round trip -- up to once per window -- for a token the
  // route never checks.
  baseQuery: backendBaseQuery("flowsheet", { skipAuth: true }),
  endpoints: (builder) => ({
    getArchiveStream: builder.infiniteQuery<
      ArchiveStreamPage,
      ArchiveStreamArg,
      ArchiveStreamCursor
    >({
      // The head page goes stale from the moment it is anchored, and every
      // later page chains off it, so a walk retained past its screen would
      // greet the next arrival without whatever aired in between. Dropping it
      // on the last unsubscribe makes each arrival start from the present.
      keepUnusedDataFor: 0,
      // The walk carries state across many requests, so a broken window must
      // fail the page rather than read as a quiet stretch and silently drop
      // that window's rows from the listing.
      extraOptions: { surfaceNonJsonAsError: true },
      infiniteQueryOptions: {
        initialPageParam: "now",
        getNextPageParam: (lastPage) =>
          lastPage.reachedStart ? undefined : lastPage.nextCursor,
      },
      queryFn: async ({ queryArg, pageParam }, _api, _extraOptions, fetchWithBQ) => {
        const seenIds = new Set<number>();
        const entries: FlowsheetRangeEntry[] = [];
        let windowEnd = pageParam === "now" ? Date.now() : pageParam;
        let requestEnd = pageParam === "now" ? windowEnd + CLOCK_SKEW_ALLOWANCE_MS : windowEnd;
        let width = MIN_WINDOW_MS;

        for (
          let windows = 0;
          windows < MAX_WINDOWS_PER_PAGE &&
          // At least one window, so a page always moves the cursor.
          (windows === 0 || entries.length < queryArg.pageSize) &&
          windowEnd > ARCHIVE_START_MS;
          windows++
        ) {
          const windowStart = Math.max(windowEnd - width, ARCHIVE_START_MS);
          const result = await fetchWithBQ({
            url: "/range",
            // Epoch milliseconds, not ISO strings: the endpoint rejects
            // anything that is not an integer.
            params: { start: windowStart, end: requestEnd },
          });
          if (result.error) {
            return { error: result.error };
          }

          // RTK's JSON handler resolves a zero-length 2xx body to `null`
          // without an error, which the opt-out above never sees. This route
          // always answers an object, so an empty body is a broken hop, and
          // it fails the page the same way an unparseable one does.
          const rangeWindow = result.data as FlowsheetRangeResponse | null;
          if (!rangeWindow) {
            const emptyBody: FetchBaseQueryError = {
              status: "PARSING_ERROR",
              originalStatus: result.meta?.response?.status ?? 200,
              data: "",
              error: "Empty response body",
            };
            return { error: emptyBody };
          }

          const fresh = rangeWindow.entries.filter((entry) => !seenIds.has(entry.id));
          fresh.forEach((entry) => seenIds.add(entry.id));
          // Each window arrives oldest first and is older than everything
          // already accumulated, so reversed it continues the newest-first run.
          entries.push(...fresh.reverse());

          // "No new rows", not "no rows": a window that only re-serves rows
          // this page already holds is walked like a gap, not a busy day.
          width = fresh.length === 0 ? Math.min(width * 2, MAX_WINDOW_MS) : MIN_WINDOW_MS;
          windowEnd = windowStart;
          requestEnd = windowStart;
        }

        return {
          data:
            windowEnd <= ARCHIVE_START_MS
              ? { entries, reachedStart: true, nextCursor: null }
              : { entries, reachedStart: false, nextCursor: windowEnd },
        };
      },
    }),
  }),
});

export const { useGetArchiveStreamInfiniteQuery } = archiveStreamApi;
