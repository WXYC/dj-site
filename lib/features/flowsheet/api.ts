import { createApi } from "@reduxjs/toolkit/query/react";
import { DJRequestParams } from "../authentication/types";
import { backendBaseQuery } from "../backend";
import {
  FLOWSHEET_OPTIMISTIC_DJ_PLACEHOLDER,
  FLOWSHEET_PAGE_SIZE,
} from "./constants";
import {
  convertDJsOnAir,
  convertV2Entry,
  convertV2FlowsheetResponse,
  extractFlowsheetEntries,
  formatOnAirSummary,
} from "./conversions";
import {
  buildOptimisticEntry,
  insertEntrySortedFirstPage,
  patchEntryById,
  removeEntryById,
  replaceEntryIdAllPages,
  swapPlayOrdersForSwitch,
} from "./infinite-cache";
import {
  FlowsheetEntry,
  FlowsheetSubmissionParams,
  FlowsheetSwitchParams,
  FlowsheetUpdateParams,
  FlowsheetV2EntryJSON,
  FlowsheetV2PaginatedResponseJSON,
  OnAirDJData,
  OnAirDJResponse,
  SuggestTrackResult,
  TrackDetailsResult,
} from "./types";

function flowsheetMutationCatch(endpoint: string, err: unknown) {
  if (process.env.NODE_ENV === "development") {
    console.warn(`[flowsheet] ${endpoint}`, err);
  }
}

export const flowsheetApi = createApi({
  reducerPath: "flowsheetApi",
  baseQuery: backendBaseQuery("flowsheet"),
  tagTypes: ["NowPlaying", "WhoIsLive", "Flowsheet"],
  endpoints: (builder) => ({
    getNowPlaying: builder.query<FlowsheetEntry | null, void>({
      query: () => ({
        url: "/latest",
      }),
      transformResponse: (response: FlowsheetV2EntryJSON | null) =>
        response ? convertV2Entry(response) : null,
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
          lastPage.length < FLOWSHEET_PAGE_SIZE
            ? undefined
            : lastPageParam + 1,
      },
      query({ pageParam }) {
        return {
          url: `/?page=${pageParam}&limit=${FLOWSHEET_PAGE_SIZE}`,
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
      invalidatesTags: ["NowPlaying"],
      async onQueryStarted(arg, { dispatch, queryFulfilled }) {
        const patchResult = dispatch(
          flowsheetApi.util.updateQueryData(
            "getInfiniteEntries",
            undefined,
            (draft) => {
              swapPlayOrdersForSwitch(draft, arg.entry_id, arg.new_position);
            }
          )
        );
        try {
          await queryFulfilled;
          dispatch(flowsheetApi.util.invalidateTags(["Flowsheet"]));
        } catch (err) {
          flowsheetMutationCatch("switchEntries", err);
          patchResult.undo();
        }
      },
    }),
    joinShow: builder.mutation<void, DJRequestParams>({
      query: (params) => ({
        url: "/join",
        method: "POST",
        body: params,
      }),
      invalidatesTags: ["NowPlaying", "WhoIsLive"],
      async onQueryStarted(arg, { dispatch, queryFulfilled }) {
        const patchLive = dispatch(
          flowsheetApi.util.updateQueryData(
            "whoIsLive",
            undefined,
            (draft) => {
              if (!draft?.djs) return;
              if (!draft.djs.some((d) => d.id === arg.dj_id)) {
                draft.djs.push({
                  id: arg.dj_id,
                  dj_name: FLOWSHEET_OPTIMISTIC_DJ_PLACEHOLDER,
                });
                draft.onAir = formatOnAirSummary(draft.djs);
              }
            }
          )
        );
        try {
          await queryFulfilled;
          dispatch(flowsheetApi.util.invalidateTags(["Flowsheet"]));
        } catch (err) {
          flowsheetMutationCatch("joinShow", err);
          patchLive.undo();
        }
      },
    }),
    leaveShow: builder.mutation<void, DJRequestParams>({
      query: (params) => ({
        url: "/end",
        method: "POST",
        body: params,
      }),
      invalidatesTags: ["NowPlaying", "WhoIsLive"],
      async onQueryStarted(arg, { dispatch, queryFulfilled }) {
        const patchLive = dispatch(
          flowsheetApi.util.updateQueryData(
            "whoIsLive",
            undefined,
            (draft) => {
              if (!draft?.djs) return;
              draft.djs = draft.djs.filter((d) => d.id !== arg.dj_id);
              draft.onAir = formatOnAirSummary(draft.djs);
            }
          )
        );
        try {
          await queryFulfilled;
          dispatch(flowsheetApi.util.invalidateTags(["Flowsheet"]));
        } catch (err) {
          flowsheetMutationCatch("leaveShow", err);
          patchLive.undo();
        }
      },
    }),
    whoIsLive: builder.query<OnAirDJData, void>({
      query: () => ({
        url: "/djs-on-air",
      }),
      transformResponse: (response: OnAirDJResponse[]): OnAirDJData =>
        convertDJsOnAir(response),
      providesTags: ["WhoIsLive"],
    }),
    addToFlowsheet: builder.mutation<FlowsheetEntry, FlowsheetSubmissionParams>(
      {
        query: (params) => ({
          url: "/",
          method: "POST",
          body: params,
        }),
        transformResponse: (response: FlowsheetV2EntryJSON) =>
          convertV2Entry(response),
        invalidatesTags: ["NowPlaying"],
        async onQueryStarted(arg, { dispatch, queryFulfilled, getState }) {
          const root = getState() as {
            flowsheetApi: ReturnType<typeof flowsheetApi.reducer>;
          };
          const cached =
            flowsheetApi.endpoints.getInfiniteEntries.select(undefined)(root);

          let tempId: number | undefined;
          let patchResult: { undo: () => void } | undefined;

          // Optimistic entry only when the cache already has pages —
          // buildOptimisticEntry needs existing data for play_order and show_id.
          if (cached?.data?.pages?.length) {
            const { entry, tempId: tid } = buildOptimisticEntry(
              arg,
              cached.data
            );
            tempId = tid;
            patchResult = dispatch(
              flowsheetApi.util.updateQueryData(
                "getInfiniteEntries",
                undefined,
                (draft) => {
                  insertEntrySortedFirstPage(draft, entry);
                }
              )
            );
          }

          try {
            const { data } = await queryFulfilled;
            // Always insert the server response directly. When the cache is
            // uninitialized, updateQueryData is a no-op and the in-flight
            // initial GET will return with the new entry included.
            dispatch(
              flowsheetApi.util.updateQueryData(
                "getInfiniteEntries",
                undefined,
                (draft) => {
                  if (tempId !== undefined) {
                    replaceEntryIdAllPages(draft, tempId, data);
                  } else {
                    insertEntrySortedFirstPage(draft, data);
                  }
                }
              )
            );
          } catch (err) {
            flowsheetMutationCatch("addToFlowsheet", err);
            patchResult?.undo();
          }
        },
      }
    ),
    removeFromFlowsheet: builder.mutation<void, number>({
      query: (entry_id) => ({
        url: "/",
        method: "DELETE",
        body: {
          entry_id,
        },
      }),
      invalidatesTags: ["NowPlaying"],
      async onQueryStarted(entry_id, { dispatch, queryFulfilled }) {
        const patchResult = dispatch(
          flowsheetApi.util.updateQueryData(
            "getInfiniteEntries",
            undefined,
            (draft) => {
              removeEntryById(draft, entry_id);
            }
          )
        );
        try {
          await queryFulfilled;
          dispatch(flowsheetApi.util.invalidateTags(["Flowsheet"]));
        } catch (err) {
          flowsheetMutationCatch("removeFromFlowsheet", err);
          patchResult.undo();
        }
      },
    }),
    // Ghost text autocomplete suggestions
    suggestArtists: builder.query<string[], { q: string; limit?: number }>({
      query: ({ q, limit }) => ({
        url: "/suggest/artists",
        params: { q, limit },
      }),
    }),
    suggestTracks: builder.query<
      SuggestTrackResult[],
      { q: string; artist: string; limit?: number }
    >({
      query: ({ q, artist, limit }) => ({
        url: "/suggest/tracks",
        params: { q, artist, limit },
      }),
    }),
    getTrackDetails: builder.query<
      TrackDetailsResult | null,
      { artist: string; track: string }
    >({
      query: ({ artist, track }) => ({
        url: "/suggest/track-details",
        params: { artist, track },
      }),
    }),
    updateFlowsheet: builder.mutation<void, FlowsheetUpdateParams>({
      query: (params) => ({
        url: "/",
        method: "PATCH",
        body: params,
      }),
      invalidatesTags: ["NowPlaying"],
      async onQueryStarted(arg, { dispatch, queryFulfilled }) {
        const patchResult = dispatch(
          flowsheetApi.util.updateQueryData(
            "getInfiniteEntries",
            undefined,
            (draft) => {
              patchEntryById(draft, arg.entry_id, arg.data as Partial<FlowsheetEntry>);
            }
          )
        );
        try {
          await queryFulfilled;
          dispatch(flowsheetApi.util.invalidateTags(["Flowsheet"]));
        } catch (err) {
          flowsheetMutationCatch("updateFlowsheet", err);
          patchResult.undo();
        }
      },
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
  useSuggestArtistsQuery,
  useSuggestTracksQuery,
  useGetTrackDetailsQuery,
} = flowsheetApi;
