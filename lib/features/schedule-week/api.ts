import { createApi } from "@reduxjs/toolkit/query/react";
import { backendBaseQuery } from "../backend";
import type { FlowsheetRangeResponse } from "@wxyc/shared";

export type FlowsheetRangeArg = {
  /** Inclusive start of the window, epoch milliseconds. */
  startMs: number;
  /** Exclusive end of the window, epoch milliseconds. */
  endMs: number;
};

const EMPTY_RANGE: FlowsheetRangeResponse = {
  shows: [],
  entries: [],
} as FlowsheetRangeResponse;

export const scheduleWeekApi = createApi({
  reducerPath: "scheduleWeekApi",
  baseQuery: backendBaseQuery("flowsheet"),
  endpoints: (builder) => ({
    getFlowsheetRange: builder.query<FlowsheetRangeResponse, FlowsheetRangeArg>({
      query: ({ startMs, endMs }) => ({
        url: "/range",
        // Epoch milliseconds, not ISO strings: the endpoint rejects anything
        // that is not an integer.
        params: { start: startMs, end: endMs },
      }),
      // A past week is immutable and the response carries no Cache-Control, so
      // this retention is the only thing between week-to-week navigation and
      // re-fetching half a megabyte that has not changed.
      keepUnusedDataFor: 600,
      // The shared base query soft-fails an unparseable body to null rather
      // than surfacing a global toast, so a transform that assumes a parsed
      // body throws on exactly the responses it was meant to absorb.
      transformResponse: (response: FlowsheetRangeResponse | null) =>
        response ?? EMPTY_RANGE,
    }),
  }),
});

export const { useGetFlowsheetRangeQuery } = scheduleWeekApi;
