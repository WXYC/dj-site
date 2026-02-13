import { createApi } from "@reduxjs/toolkit/query/react";
import { DJRequestParams } from "../authentication/types";
import { backendBaseQuery } from "../backend";
import {
  convertDJsOnAir,
  convertV2Entry,
  convertV2FlowsheetResponse,
} from "./conversions";
import {
  FlowsheetEntry,
  FlowsheetRequestParams,
  FlowsheetSubmissionParams,
  FlowsheetSwitchParams,
  FlowsheetUpdateParams,
  FlowsheetV2EntryJSON,
  FlowsheetV2PaginatedResponseJSON,
  OnAirDJData,
  OnAirDJResponse,
} from "./types";

export const flowsheetApi = createApi({
  reducerPath: "flowsheetApi",
  baseQuery: backendBaseQuery(""),
  tagTypes: ["NowPlaying", "WhoIsLive", "Flowsheet"],
  endpoints: (builder) => ({
    getNowPlaying: builder.query<FlowsheetEntry, void>({
      query: () => ({
        url: "v2/flowsheet/latest",
      }),
      transformResponse: (response: FlowsheetV2EntryJSON) =>
        convertV2Entry(response),
      providesTags: ["NowPlaying"],
    }),
    getEntries: builder.query<FlowsheetEntry[], FlowsheetRequestParams>({
      query: (params) => ({
        url: !params
          ? "v2/flowsheet/"
          : `v2/flowsheet/?page=${params.page}&limit=${params.limit}`,
      }),
      serializeQueryArgs: ({ endpointName }) => endpointName,
      transformResponse: (response: FlowsheetV2PaginatedResponseJSON) =>
        convertV2FlowsheetResponse(response.entries),
      providesTags: ["Flowsheet"],
      merge: (currentCache, newItems) => {
        const map = new Map(currentCache.map((entry) => [entry.id, entry]));
        newItems.forEach((entry) => {
          map.set(entry.id, entry);
        });
        return Array.from(map.values()).sort(
          (a, b) => b.play_order - a.play_order
        );
      },
      forceRefetch({ currentArg, previousArg }) {
        return (
          currentArg?.page !== previousArg?.page ||
          currentArg?.limit !== previousArg?.limit
        );
      },
    }),
    switchEntries: builder.mutation<undefined, FlowsheetSwitchParams>({
      query: (params) => ({
        url: "flowsheet/play-order",
        method: "PATCH",
        body: params,
      }),
      invalidatesTags: ["Flowsheet", "NowPlaying"],
    }),
    joinShow: builder.mutation<any, DJRequestParams>({
      query: (params) => ({
        url: "flowsheet/join",
        method: "POST",
        body: params,
      }),
      invalidatesTags: ["NowPlaying", "WhoIsLive", "Flowsheet"],
    }),
    leaveShow: builder.mutation<any, DJRequestParams>({
      query: (params) => ({
        url: "flowsheet/end",
        method: "POST",
        body: params,
      }),
      invalidatesTags: ["NowPlaying", "WhoIsLive", "Flowsheet"],
    }),
    whoIsLive: builder.query<OnAirDJData, void>({
      query: () => ({
        url: "flowsheet/djs-on-air",
      }),
      transformResponse: (response: OnAirDJResponse[]): OnAirDJData =>
        convertDJsOnAir(response),
      providesTags: ["WhoIsLive"],
    }),
    addToFlowsheet: builder.mutation<any, FlowsheetSubmissionParams>({
      query: (params) => ({
        url: "flowsheet/",
        method: "POST",
        body: params,
      }),
      invalidatesTags: ["Flowsheet", "NowPlaying"],
    }),
    removeFromFlowsheet: builder.mutation<any, number>({
      query: (entry_id) => ({
        url: "flowsheet/",
        method: "DELETE",
        body: {
          entry_id,
        },
      }),
      invalidatesTags: ["Flowsheet", "NowPlaying"],
    }),
    updateFlowsheet: builder.mutation<any, FlowsheetUpdateParams>({
      query: (params) => ({
        url: "flowsheet/",
        method: "PATCH",
        body: params,
      }),
      invalidatesTags: ["Flowsheet", "NowPlaying"],
    }),
  }),
});

export const {
  useGetNowPlayingQuery,
  useGetEntriesQuery,
  useJoinShowMutation,
  useLeaveShowMutation,
  useWhoIsLiveQuery,
  useAddToFlowsheetMutation,
  useRemoveFromFlowsheetMutation,
  useUpdateFlowsheetMutation,
  useSwitchEntriesMutation,
} = flowsheetApi;
