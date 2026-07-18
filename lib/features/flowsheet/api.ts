import { createApi } from "@reduxjs/toolkit/query/react";
import { DJRequestParams } from "../authentication/types";
import { backendBaseQuery } from "../backend";
import { FLOWSHEET_PAGE_SIZE } from "./constants";
import { scheduleDeferredFlowsheetRefetch } from "./deferred-refetch";
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
  maxPlayOrder,
  movePlayOrder,
  nextOptimisticTempId,
  patchEntryById,
  removeEntryById,
  replaceEntryIdAllPages,
} from "./infinite-cache";
import {
  FlowsheetEntry,
  FlowsheetShowBlockEntry,
  FlowsheetSubmissionParams,
  isFlowsheetStartShowEntry,
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
      // `backendBaseQuery` soft-fails non-JSON GETs to `{data: null}` (#606);
      // guard so a gateway interstitial can't crash the transform.
      transformResponse: (
        response: FlowsheetV2PaginatedResponseJSON | FlowsheetV2EntryJSON[] | null
      ) => (response ? convertV2FlowsheetResponse(extractFlowsheetEntries(response)) : []),
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
        // The optimistic move mirrors the server's renumber exactly, so
        // success needs no refetch — re-pulling every loaded page after each
        // drop churned row identities and stalled the settle animation. On
        // failure, revert and resync against the server.
        const patchResult = dispatch(
          flowsheetApi.util.updateQueryData(
            "getInfiniteEntries",
            undefined,
            (draft) => {
              movePlayOrder(draft, arg.entry_id, arg.new_position);
            }
          )
        );
        try {
          await queryFulfilled;
        } catch (err) {
          flowsheetMutationCatch("switchEntries", err);
          patchResult.undo();
          dispatch(flowsheetApi.util.invalidateTags(["Flowsheet"]));
        }
      },
    }),
    joinShow: builder.mutation<
      void,
      DJRequestParams & { dj_name?: string; dj_name_override?: string }
    >({
      // `dj_name` is a client-only display hint for the optimistic patches
      // below; keep it off the wire (the backend derives the on-air name from
      // dj_id / dj_name_override).
      query: ({ dj_name: _dj_name, ...params }) => ({
        url: "/join",
        method: "POST",
        body: params,
      }),
      invalidatesTags: ["NowPlaying", "WhoIsLive"],
      async onQueryStarted(arg, { dispatch, queryFulfilled, getState }) {
        // Seed the banner with the real dj_name so the public /live page never
        // renders a "Live" placeholder during the refetch window. A joiner
        // with no display name must not blank the banner or leave a trailing
        // comma: format only the named DJs, and when none exist keep the
        // previous banner until the refetch lands. (#621)
        const patchLive = dispatch(
          flowsheetApi.util.updateQueryData(
            "whoIsLive",
            undefined,
            (draft) => {
              if (!draft?.djs) return;
              if (!draft.djs.some((d) => d.id === arg.dj_id)) {
                draft.djs.push({
                  id: arg.dj_id,
                  dj_name: arg.dj_name ?? "",
                });
                const named = draft.djs.filter((d) => d.dj_name);
                if (named.length) {
                  draft.onAir = formatOnAirSummary(named);
                }
              }
            }
          )
        );
        // One optimistic show-start marker seeds both caches: the entries feed
        // (so `currentShow` — the newest entry's show_id — no longer resolves
        // to the prior show, leaving its tail editable) and the Now Playing
        // card (so "started the set" shows before any song is added, without
        // waiting on the post-join refetch). Fresh (negative) show_id.
        const entriesCache =
          flowsheetApi.endpoints.getInfiniteEntries.select(undefined)(
            getState()
          );
        const tempId = nextOptimisticTempId();
        const marker: FlowsheetShowBlockEntry = {
          id: tempId,
          play_order:
            (entriesCache.data ? maxPlayOrder(entriesCache.data) : 0) + 1,
          show_id: tempId,
          dj_name: arg.dj_name ?? "",
          isStart: true,
          day: "",
          time: "",
        };
        const patchEntries = dispatch(
          flowsheetApi.util.updateQueryData(
            "getInfiniteEntries",
            undefined,
            (draft) => {
              if (!draft.pages.length) return;
              insertEntrySortedFirstPage(draft, marker);
            }
          )
        );
        const patchNowPlaying = dispatch(
          flowsheetApi.util.updateQueryData(
            "getNowPlaying",
            undefined,
            () => marker
          )
        );
        try {
          await queryFulfilled;
          dispatch(flowsheetApi.util.invalidateTags(["Flowsheet"]));
        } catch (err) {
          flowsheetMutationCatch("joinShow", err);
          patchLive.undo();
          patchEntries.undo();
          patchNowPlaying.undo();
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
      async onQueryStarted(arg, { dispatch, queryFulfilled, getState }) {
        // The leave arg carries no dj_name, so resolve the departing DJ's name
        // from the whoIsLive cache before patchLive filters them out — the
        // show-end card needs it.
        const state = getState();
        const departingDjName =
          flowsheetApi.endpoints.whoIsLive
            .select(undefined)(state)
            .data?.djs.find((d) => d.id === arg.dj_id)?.dj_name ?? "";
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
        // Leaving before joinShow's refetch lands would orphan the optimistic
        // show-start marker (negative show_id) as a stray row — drop any such
        // markers here. (#619)
        const patchEntries = dispatch(
          flowsheetApi.util.updateQueryData(
            "getInfiniteEntries",
            undefined,
            (draft) => {
              for (const page of draft.pages) {
                for (let i = page.length - 1; i >= 0; i--) {
                  const entry = page[i];
                  if (entry.show_id < 0 && isFlowsheetStartShowEntry(entry)) {
                    page.splice(i, 1);
                  }
                }
              }
            }
          )
        );
        // Mirror the show-end onto the Now Playing card so it flips to the
        // show-end state immediately, without waiting on the refetch.
        const entriesCache =
          flowsheetApi.endpoints.getInfiniteEntries.select(undefined)(state);
        const endTempId = nextOptimisticTempId();
        const endMarker: FlowsheetShowBlockEntry = {
          id: endTempId,
          play_order:
            (entriesCache.data ? maxPlayOrder(entriesCache.data) : 0) + 1,
          show_id: endTempId,
          dj_name: departingDjName,
          isStart: false,
          day: "",
          time: "",
        };
        const patchNowPlaying = dispatch(
          flowsheetApi.util.updateQueryData(
            "getNowPlaying",
            undefined,
            () => endMarker
          )
        );
        try {
          await queryFulfilled;
          dispatch(flowsheetApi.util.invalidateTags(["Flowsheet"]));
        } catch (err) {
          flowsheetMutationCatch("leaveShow", err);
          patchLive.undo();
          patchEntries.undo();
          patchNowPlaying.undo();
        }
      },
    }),
    whoIsLive: builder.query<OnAirDJData, void>({
      query: () => ({
        url: "/djs-on-air",
      }),
      // convertDJsOnAir already maps a missing list to the off-air shape;
      // widen for the #606 null soft-fail so it takes that path.
      transformResponse: (response: OnAirDJResponse[] | null): OnAirDJData =>
        convertDJsOnAir(response ?? undefined),
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
            scheduleDeferredFlowsheetRefetch(dispatch, data.id);
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
