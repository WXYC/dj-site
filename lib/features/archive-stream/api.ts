import { createApi } from "@reduxjs/toolkit/query/react";
import { backendBaseQuery } from "../backend";
import type { FlowsheetRangeEntry, FlowsheetRangeResponse } from "@wxyc/shared";

export type ArchiveStreamArg = {
  /** Exclusive upper bound to walk backwards from, epoch milliseconds. Omitted means "now". */
  cursor?: number;
  /** Floor on how many entries to accumulate before returning a page -- the
   * walk stops as soon as it has at least this many rather than slicing mid-
   * window, so a page can come back somewhat larger than requested. */
  pageSize: number;
};

export type ArchiveStreamPage = {
  /** Oldest first, matching the wire order of each `/flowsheet/range` window. */
  entries: FlowsheetRangeEntry[];
  /** Pass back as `cursor` to continue the walk. `null` once `reachedStart` is true. */
  nextCursor: number | null;
  /** True once the walk gave up looking for older rows -- see
   * `MAX_CONSECUTIVE_EMPTY_WINDOWS`. A short page (`entries.length < pageSize`
   * asked for) happens if and only if this is true; a page never falls short
   * for any other reason. */
  reachedStart: boolean;
};

const EMPTY_RANGE: FlowsheetRangeResponse = { shows: [], entries: [] };

/**
 * Width of each backward step. `/flowsheet/range` rejects anything wider than
 * an 8-day window (`MAX_RANGE_MS`, Backend-Service `flowsheet.controller.ts`);
 * this stays far under that cap so a step never risks the 400, and so a single
 * non-empty window rarely dwarfs a requested page.
 */
const WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * Consecutive empty windows tolerated before the walk concludes it has
 * reached the start of the archive. The station goes dark for stretches
 * longer than a single quiet day -- a holiday, an outage -- so stopping on
 * the first empty window would truncate the archive at the first gap rather
 * than at its actual start.
 */
export const MAX_CONSECUTIVE_EMPTY_WINDOWS = 7;

export const archiveStreamApi = createApi({
  reducerPath: "archiveStreamApi",
  baseQuery: backendBaseQuery("flowsheet"),
  endpoints: (builder) => ({
    getArchiveStream: builder.query<ArchiveStreamPage, ArchiveStreamArg>({
      // Nothing about an already-walked page changes later, so the only cost
      // of holding onto it is memory -- matches scheduleWeekApi's reasoning.
      keepUnusedDataFor: 600,
      queryFn: async ({ cursor, pageSize }, _queryApi, _extraOptions, fetchWithBQ) => {
        const seenIds = new Set<number>();
        const entries: FlowsheetRangeEntry[] = [];
        let windowEnd = cursor ?? Date.now();
        let emptyStreak = 0;
        let reachedStart = false;

        while (entries.length < pageSize) {
          const windowStart = windowEnd - WINDOW_MS;
          const result = await fetchWithBQ({
            url: "/range",
            // Epoch milliseconds, not ISO strings: the endpoint rejects
            // anything that is not an integer.
            params: { start: windowStart, end: windowEnd },
          });
          if (result.error) {
            return { error: result.error };
          }

          // The shared base query soft-fails an unparseable body to `{ data:
          // null }` rather than throwing, so a window that hit that path must
          // read as empty rather than assuming a parsed body below.
          const window = (result.data as FlowsheetRangeResponse | null) ?? EMPTY_RANGE;

          const newEntries = window.entries.filter((entry) => !seenIds.has(entry.id));
          newEntries.forEach((entry) => seenIds.add(entry.id));
          // Windows are walked newest-first, so each older window's own
          // (already ascending) entries slot in before what's accumulated.
          entries.unshift(...newEntries);

          emptyStreak = window.entries.length === 0 ? emptyStreak + 1 : 0;
          windowEnd = windowStart;

          if (emptyStreak >= MAX_CONSECUTIVE_EMPTY_WINDOWS) {
            reachedStart = true;
            break;
          }
        }

        return {
          data: {
            entries,
            nextCursor: reachedStart ? null : windowEnd,
            reachedStart,
          },
        };
      },
    }),
  }),
});

export const { useGetArchiveStreamQuery } = archiveStreamApi;
