import { createApi } from "@reduxjs/toolkit/query/react";
import { DJRequestParams } from "../authentication/types";
import { backendBaseQuery } from "../backend";
import {
  convertDJsOnAir,
  convertV2Entry,
  convertV2FlowsheetResponse,
  extractFlowsheetEntries,
} from "./conversions";
import {
  FlowsheetEntry,
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
  baseQuery: backendBaseQuery("flowsheet"),
  tagTypes: ["NowPlaying", "WhoIsLive", "Flowsheet"],
  endpoints: (builder) => ({
    getNowPlaying: builder.query<FlowsheetEntry, void>({
      query: () => ({
        url: "/latest",
      }),
      transformResponse: (response: FlowsheetV2EntryJSON) =>
        convertV2Entry(response),
      providesTags: ["NowPlaying"],
    }),
    getInfiniteEntries: builder.infiniteQuery<
      FlowsheetEntry[],
      void,
      number
    >({
      infiniteQueryOptions: {
        initialPageParam: 0,
        getNextPageParam: (lastPage, _allPages, lastPageParam) =>
          lastPage.length < 20 ? undefined : lastPageParam + 1,
      },
      query({ pageParam }) {
        return {
          url: `/?page=${pageParam}&limit=20`,
        };
      },
      transformResponse: (
        response: FlowsheetV2PaginatedResponseJSON | FlowsheetV2EntryJSON[]
      ) => convertV2FlowsheetResponse(extractFlowsheetEntries(response)),
      providesTags: ["Flowsheet"],
    }),
    switchEntries: builder.mutation<undefined, FlowsheetSwitchParams>({
      query: (params) => ({
        url: "/play-order",
        method: "PATCH",
        body: params,
      }),
      invalidatesTags: ["Flowsheet", "NowPlaying"],
    }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- backend response type not defined
    joinShow: builder.mutation<any, DJRequestParams>({
      query: (params) => ({
        url: "/join",
        method: "POST",
        body: params,
      }),
      invalidatesTags: ["NowPlaying", "WhoIsLive", "Flowsheet"],
    }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- backend response type not defined
    leaveShow: builder.mutation<any, DJRequestParams>({
      query: (params) => ({
        url: "/end",
        method: "POST",
        body: params,
      }),
      invalidatesTags: ["NowPlaying", "WhoIsLive", "Flowsheet"],
    }),
    whoIsLive: builder.query<OnAirDJData, void>({
      query: () => ({
        url: "/djs-on-air",
      }),
      transformResponse: (response: OnAirDJResponse[]): OnAirDJData =>
        convertDJsOnAir(response),
      providesTags: ["WhoIsLive"],
    }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- backend response type not defined
    addToFlowsheet: builder.mutation<any, FlowsheetSubmissionParams>({
      query: (params) => ({
        url: "/",
        method: "POST",
        body: params,
      }),
      invalidatesTags: ["Flowsheet", "NowPlaying"],
    }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- backend response type not defined
    removeFromFlowsheet: builder.mutation<any, number>({
      query: (entry_id) => ({
        url: "/",
        method: "DELETE",
        body: {
          entry_id,
        },
      }),
      invalidatesTags: ["Flowsheet", "NowPlaying"],
    }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- backend response type not defined
    updateFlowsheet: builder.mutation<any, FlowsheetUpdateParams>({
      query: (params) => ({
        url: "/",
        method: "PATCH",
        body: params,
      }),
      invalidatesTags: ["Flowsheet", "NowPlaying"],
    }),
  }),
});

export const {
  useGetNowPlayingQuery,
  useGetInfiniteEntriesInfiniteQuery,
  useJoinShowMutation,
  useLeaveShowMutation,
  useWhoIsLiveQuery,
  useAddToFlowsheetMutation,
  useRemoveFromFlowsheetMutation,
  useUpdateFlowsheetMutation,
  useSwitchEntriesMutation,
} = flowsheetApi;
