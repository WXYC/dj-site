import { createApi } from "@reduxjs/toolkit/query/react";
import { DJRequestParams } from "../authentication/types";
import { backendBaseQuery } from "../backend";
import { convertFlowsheetResponse } from "./conversions";
import {
  FlowsheetEntry,
  FlowsheetEntryResponse,
  OnAirDJResponse,
} from "./types";

export const flowsheetApi = createApi({
  reducerPath: "flowsheetApi",
  baseQuery: backendBaseQuery("flowsheet"),
  tagTypes: ["NowPlaying", "Flowsheet", "WhoIsLive"],
  endpoints: (builder) => ({
    getNowPlaying: builder.query<any, void>({
      query: () => ({
        url: "/latest",
      }),
      providesTags: ["NowPlaying"],
    }),
    getEntries: builder.query<FlowsheetEntry[], void>({
      query: () => ({
        url: "/",
      }),
      providesTags: ["Flowsheet"],
      transformResponse: (response: FlowsheetEntryResponse[]) =>
        convertFlowsheetResponse(response),
    }),
    joinShow: builder.mutation<any, DJRequestParams>({
      query: (params) => ({
        url: "/join",
        method: "POST",
        body: params,
      }),
      invalidatesTags: ["NowPlaying", "Flowsheet", "WhoIsLive"],
    }),
    leaveShow: builder.mutation<any, DJRequestParams>({
      query: (params) => ({
        url: "/end",
        method: "POST",
        body: params,
      }),
      invalidatesTags: ["NowPlaying", "Flowsheet", "WhoIsLive"],
    }),
    whoIsLive: builder.query<OnAirDJResponse[], void>({
      query: () => ({
        url: "/djs-on-air",
      }),
      providesTags: ["WhoIsLive"],
    }),
  }),
});

export const {
  useGetNowPlayingQuery,
  useGetEntriesQuery,
  useJoinShowMutation,
  useLeaveShowMutation,
  useWhoIsLiveQuery,
} = flowsheetApi;
