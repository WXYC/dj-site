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
          dispatch(
            flowsheetApi.endpoints.getInfiniteEntries.initiate(undefined, {
              forceRefetch: true,
            })
          );
        } catch {
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
                draft.djs.push({ id: arg.dj_id, dj_name: "Live" });
                draft.onAir = draft.djs.map((d) => `DJ ${d.dj_name}`).join(", ");
              }
            }
          )
        );
        try {
          await queryFulfilled;
          dispatch(
            flowsheetApi.endpoints.getInfiniteEntries.initiate(undefined, {
              forceRefetch: true,
            })
          );
        } catch {
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
              draft.onAir =
                draft.djs.length > 0
                  ? draft.djs.map((d) => `DJ ${d.dj_name}`).join(", ")
                  : "Off Air";
            }
          )
        );
        try {
          await queryFulfilled;
          dispatch(
            flowsheetApi.endpoints.getInfiniteEntries.initiate(undefined, {
              forceRefetch: true,
            })
          );
        } catch {
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
          const selector = flowsheetApi.endpoints.getInfiniteEntries.select(
            undefined
          );
          const cached = selector(getState() as never);
          let tempId: number | undefined;
          let patchResult: { undo: () => void } | undefined;

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
            dispatch(
              flowsheetApi.endpoints.getInfiniteEntries.initiate(undefined, {
                forceRefetch: true,
              })
            );
          } catch {
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
          dispatch(
            flowsheetApi.endpoints.getInfiniteEntries.initiate(undefined, {
              forceRefetch: true,
            })
          );
        } catch {
          patchResult.undo();
        }
      },
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
          dispatch(
            flowsheetApi.endpoints.getInfiniteEntries.initiate(undefined, {
              forceRefetch: true,
            })
          );
        } catch {
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
} = flowsheetApi;
