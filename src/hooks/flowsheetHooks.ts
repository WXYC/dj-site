"use client";

import {
  flowsheetApi,
  useAddToFlowsheetMutation,
  useGetInfiniteEntriesInfiniteQuery,
  useJoinShowMutation,
  useLeaveShowMutation,
  useRemoveFromFlowsheetMutation,
  useSwitchEntriesMutation,
  useUpdateFlowsheetMutation,
  useWhoIsLiveQuery,
} from "@/lib/features/flowsheet/api";
import { convertQueryToSubmission } from "@/lib/features/flowsheet/conversions";
import { flowsheetSlice } from "@/lib/features/flowsheet/frontend";
import {
  compareEntriesNewestFirst,
  primaryShowId,
} from "@/lib/features/flowsheet/infinite-cache";
import { useFlowsheetPollingInterval } from "./useSSEConnection";
import { partitionFlowsheetEntries } from "@/lib/features/flowsheet/partition";
import {
  FlowsheetEntry,
  FlowsheetQuery,
  FlowsheetSearchProperty,
  FlowsheetSubmissionParams,
  FlowsheetUpdateParams,
} from "@/lib/features/flowsheet/types";
import type { RootState } from "@/lib/store";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import type { FormEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useRegistry } from "./authenticationHooks";
import { useBinResults } from "./binHooks";
import {
  useCatalogFlowsheetSearch,
  useRotationFlowsheetSearch,
} from "./catalogHooks";
import { useLmlLibrarySearch } from "./lml";
import { MAX_VISIBLE_RESULTS } from "@/src/components/experiences/modern/flowsheet/Search/Results/BackendResults/FlowsheetBackendResults";

const FLOWSHEET_MUTATION_ENDPOINTS = new Set([
  "addToFlowsheet",
  "removeFromFlowsheet",
  "updateFlowsheet",
  "switchEntries",
  "joinShow",
  "leaveShow",
]);

export function selectFlowsheetMutationPending(state: RootState): boolean {
  const mutations = state.flowsheetApi?.mutations;
  if (!mutations) return false;
  return Object.values(mutations).some(
    (m) =>
      m &&
      m.status === "pending" &&
      typeof m.endpointName === "string" &&
      FLOWSHEET_MUTATION_ENDPOINTS.has(m.endpointName)
  );
}

export const useShowControl = () => {
  const { loading: userloading, info: userData } = useRegistry();
  const flowsheetPollingInterval = useFlowsheetPollingInterval();

  const skip = !userData || userloading;
  const userId = userData?.id;

  // This hook runs in every entry row (and per editable field), so both query
  // subscriptions are narrowed to primitives: rows re-render only when
  // live/currentShow actually change, not on fetch-status flips or unrelated
  // cache updates — and no per-row flatten/sort of the entry list.
  const { live, loadingLiveList } = useWhoIsLiveQuery(undefined, {
    skip,
    pollingInterval: 60000,
    selectFromResult: ({ data, isLoading }) => ({
      live:
        data?.djs !== undefined &&
        data.djs.length !== 0 &&
        data.djs.some((dj) => dj.id === userId),
      loadingLiveList: isLoading,
    }),
  });

  const { currentShow } = useGetInfiniteEntriesInfiniteQuery(undefined, {
    skip,
    pollingInterval: flowsheetPollingInterval,
    selectFromResult: ({ data, isSuccess }) => ({
      // Newest entry's show_id; pages stay sorted newest-first.
      currentShow: isSuccess && data ? primaryShowId(data) : -1,
    }),
  });

  const [goLiveFunction, goingLiveResult] = useJoinShowMutation();
  const [leaveFunction, leavingResult] = useLeaveShowMutation();

  const autoplay = useAppSelector((state) => state.flowsheet.autoplay);
  const dispatch = useAppDispatch();
  const setAutoPlay = (autoplay: boolean) => {
    dispatch(flowsheetSlice.actions.setAutoplay(autoplay));
  };

  const goLive = (djNameOverride?: string) => {
    if (!userData || userData.id === undefined || userloading) {
      return;
    }
    // Tag invalidation from the mutation handles refetching.
    // Only include `dj_name_override` when the caller actually wants to
    // override; the backend treats empty/whitespace as absent, but the
    // hook keeps the wire-shape clean either way.
    // `dj_name` is a display-only hint for the optimistic WhoIsLive / feed
    // patch (so the public banner reads a real name, never "Live"); it's
    // stripped from the request body in the joinShow query. Fall through the
    // identity fields useRegistry exposes — a DJ without a registered handle
    // still has a real_name. (#619, #621)
    const payload: {
      dj_id: string;
      dj_name?: string;
      dj_name_override?: string;
    } = {
      dj_id: userData.id,
      dj_name: djNameOverride ?? userData.dj_name ?? userData.real_name,
    };
    if (djNameOverride !== undefined) {
      payload.dj_name_override = djNameOverride;
    }
    goLiveFunction(payload);
  };

  const leave = () => {
    if (!userData || userData.id === undefined || userloading) {
      return;
    }

    // Clear the queue when ending the show
    dispatch(flowsheetSlice.actions.clearQueue());
    // Tag invalidation from the mutation handles refetching
    leaveFunction({ dj_id: userData.id });
  };

  return {
    live,
    autoplay,
    setAutoPlay,
    loading:
      loadingLiveList ||
      userloading ||
      goingLiveResult.isLoading ||
      leavingResult.isLoading,
    currentShow,
    goLive,
    leave,
  };
};

/**
 * Whether any flowsheet mutation is in flight. Deliberately NOT part of
 * useShowControl: that hook runs in every entry row, and this value flips on
 * every mutation dispatch AND completion — subscribing rows to it re-renders
 * the whole table twice per save, the second time when the response lands
 * (mid-settle for drag reorders).
 */
export const useFlowsheetSaving = (): boolean =>
  useAppSelector(selectFlowsheetMutationPending);

export const useFlowsheetSearch = () => {
  const { live, loading } = useShowControl();
  const isSaving = useFlowsheetSaving();

  const dispatch = useAppDispatch();
  const searchOpen = useAppSelector((state) => state.flowsheet.search.open);
  const setSearchOpen = (open: boolean) => {
    dispatch(flowsheetSlice.actions.setSearchOpen(open));
  };
  const resetSearch = () => dispatch(flowsheetSlice.actions.resetSearch());
  const searchQuery = useAppSelector(flowsheetSlice.selectors.getSearchQuery);
  const selectedIndex = useAppSelector(flowsheetSlice.selectors.getSelectedResult);
  const setSearchProperty = (name: FlowsheetSearchProperty, value: string) => {
    dispatch(flowsheetSlice.actions.setSearchProperty({ name, value }));
  };

  // Get the selected entry from search results
  const { searchResults: binResults } = useBinResults();
  const { searchResults: catalogResults } = useCatalogFlowsheetSearch();
  const { searchResults: rotationResults } = useRotationFlowsheetSearch();
  const { results: rawLmlResults } = useLmlLibrarySearch({
    artist: searchQuery.artist,
    album: searchQuery.album,
  });

  // Deduplicate LML results against the other three sources
  const lmlResults = useMemo(() => {
    const seen = new Set<number>();
    for (const r of binResults) seen.add(r.id);
    for (const r of rotationResults) seen.add(r.id);
    for (const r of catalogResults) seen.add(r.id);
    return rawLmlResults.filter((r) => !seen.has(r.id));
  }, [binResults, rotationResults, catalogResults, rawLmlResults]);

  // Each section is capped to MAX_VISIBLE_RESULTS in the results dropdown, so
  // the selectedResult index space maps into the capped concatenation — same
  // order and same cap as FlowsheetSearchResults' offsets, keeping the
  // highlighted row and the resolved entry in lockstep. (#657)
  const allSearchResults = useMemo(() => [
    ...binResults.slice(0, MAX_VISIBLE_RESULTS),
    ...rotationResults.slice(0, MAX_VISIBLE_RESULTS),
    ...catalogResults.slice(0, MAX_VISIBLE_RESULTS),
    ...lmlResults.slice(0, MAX_VISIBLE_RESULTS),
  ], [binResults, rotationResults, catalogResults, lmlResults]);

  const selectedEntry = useMemo(() => {
    if (selectedIndex === 0) return null;
    return allSearchResults[selectedIndex - 1] ?? null;
  }, [selectedIndex, allSearchResults]);

  // Get the display value for a field - either from selected result or raw query
  const getDisplayValue = useCallback((name: FlowsheetSearchProperty): string => {
    if (selectedIndex === 0 || !selectedEntry) {
      // Show raw query values when creating new
      return searchQuery[name] as string;
    }
    
    // Show selected result values when a result is selected
    switch (name) {
      case "song":
        return searchQuery.song as string; // Always show user input for song
      case "artist":
        return selectedEntry.artist?.name || searchQuery.artist as string;
      case "album":
        return selectedEntry.title || searchQuery.album as string;
      case "label":
        return selectedEntry.label || searchQuery.label as string;
      default:
        return searchQuery[name] as string;
    }
  }, [selectedIndex, selectedEntry, searchQuery]);

  return {
    live,
    loading,
    isSaving,
    searchOpen,
    setSearchOpen,
    resetSearch,
    searchQuery,
    selectedIndex,
    selectedEntry,
    setSearchProperty,
    getDisplayValue,
  };
};

export const useFlowsheet = () => {
  const { loading: userloading, info: userData } = useRegistry();
  const flowsheetPollingInterval = useFlowsheetPollingInterval();

  const {
    data: infiniteData,
    isLoading,
    isSuccess,
    isError,
    isFetching,
    hasNextPage,
    fetchNextPage,
  } = useGetInfiniteEntriesInfiniteQuery(undefined, {
    skip: !userData || userloading,
    pollingInterval: flowsheetPollingInterval,
  });

  // Flatten all pages into a single deduplicated, sorted array
  const allEntries = useMemo(() => {
    if (!infiniteData?.pages) return [];
    const map = new Map<number, FlowsheetEntry>();
    infiniteData.pages.flat().forEach((entry) => map.set(entry.id, entry));
    return Array.from(map.values()).sort(compareEntriesNewestFirst);
  }, [infiniteData?.pages]);

  const actions = useFlowsheetActions();

  const { currentShow, live } = useShowControl();

  // Partition entries into current show vs previous shows. All entries from
  // the current show (including start/end markers) go into currentShowEntries,
  // sorted play_order DESC so persisted reorders are reflected.
  const { current: currentShowEntries, previous: lastShowsEntries } = useMemo(
    () => partitionFlowsheetEntries(allEntries, currentShow, live),
    [allEntries, currentShow, live]
  );

  return {
    entries: {
      current: currentShowEntries,
      previous: lastShowsEntries,
      switchEntries: actions.switchEntries,
    },
    addToFlowsheet: actions.addToFlowsheet,
    removeFromFlowsheet: actions.removeFromFlowsheet,
    updateFlowsheet: actions.updateFlowsheet,
    removeFromQueue: actions.removeFromQueue,
    loading: isLoading || userloading,
    isFetching,
    hasNextPage,
    fetchNextPage,
    isSuccess,
    isError,
  };
};

// Mutation result state is never consumed, and the hosts of these hooks
// range from the flowsheet page to every row action — an empty
// selectFromResult keeps mutation lifecycle flips (pending at dispatch,
// fulfilled when the response lands) from re-rendering any of them.
const NO_MUTATION_STATE = { selectFromResult: () => ({}) };

/**
 * Flowsheet mutation callbacks with no query subscriptions. Row-level
 * components (entry fields, controls, remove buttons, the Mail Bin) must use
 * this instead of useFlowsheet: the full hook subscribes to the entries
 * query and re-sorts every loaded entry per cache update, which multiplied
 * by hundreds of row-level instances is a serious per-update cost.
 */
export const useFlowsheetActions = () => {
  const { loading: userloading, info: userData } = useRegistry();
  const dispatch = useAppDispatch();

  const [addToFlowsheetMutation] = useAddToFlowsheetMutation(NO_MUTATION_STATE);
  // Stable identity so consumers (e.g. the Mail Bin's per-row action memos)
  // can hold it in dependency arrays without recomputing every render.
  const addToFlowsheet = useCallback(
    (arg: FlowsheetSubmissionParams) => {
      if (!userData || userData.id === undefined || userloading) {
        return Promise.reject('User not logged in');
      }

      // Tag invalidation from the mutation handles refetching
      return addToFlowsheetMutation(arg).unwrap();
    },
    [addToFlowsheetMutation, userData, userloading]
  );

  const [removeFromFlowsheetMutation] =
    useRemoveFromFlowsheetMutation(NO_MUTATION_STATE);
  const removeFromFlowsheet = useCallback(
    (entry: number) => {
      if (!userData || userData.id === undefined || userloading) {
        return;
      }
      removeFromFlowsheetMutation(entry);
    },
    [removeFromFlowsheetMutation, userData, userloading]
  );

  const [updateFlowsheetMutation] =
    useUpdateFlowsheetMutation(NO_MUTATION_STATE);
  const updateFlowsheet = useCallback(
    (updateData: FlowsheetUpdateParams) => {
      if (!userData || userData.id === undefined || userloading) {
        return;
      }
      updateFlowsheetMutation(updateData);
    },
    [updateFlowsheetMutation, userData, userloading]
  );

  const [switchEntriesMutation] = useSwitchEntriesMutation(NO_MUTATION_STATE);
  // Position math (which play_order the entry should land on) belongs to the
  // caller — only the page owning the drag state knows the pre-drag vs
  // post-drag visual order.
  const switchEntries = useCallback(
    async (entry: FlowsheetEntry, newPosition: number) => {
      if (!userData?.id || userloading) return;

      try {
        // Tag invalidation from the mutation handles refetching
        await switchEntriesMutation({
          entry_id: entry.id,
          new_position: newPosition,
        });
      } catch (err) {
        console.error("Failed to switch entries:", err);
      }
    },
    [userData?.id, userloading, switchEntriesMutation]
  );

  const removeFromQueue = useCallback(
    (entry: number) => dispatch(flowsheetSlice.actions.removeFromQueue(entry)),
    [dispatch]
  );

  return {
    addToFlowsheet,
    removeFromFlowsheet,
    updateFlowsheet,
    switchEntries,
    removeFromQueue,
  };
};

/**
 * Pagination state only — for consumers (InfiniteScroller) that drive
 * fetching but never render entries, sparing them useFlowsheet's per-update
 * flatten/sort/partition work.
 */
export const useFlowsheetPagination = () => {
  const { loading: userloading, info: userData } = useRegistry();
  const flowsheetPollingInterval = useFlowsheetPollingInterval();

  const { isLoading, isFetching, hasNextPage, fetchNextPage } =
    useGetInfiniteEntriesInfiniteQuery(undefined, {
      skip: !userData || userloading,
      pollingInterval: flowsheetPollingInterval,
      selectFromResult: ({ isLoading, isFetching, hasNextPage }) => ({
        isLoading,
        isFetching,
        hasNextPage,
      }),
    });

  return {
    loading: isLoading || userloading,
    isFetching,
    hasNextPage,
    fetchNextPage,
  };
};

export const useQueue = () => {
  const { live, loading } = useShowControl();
  const { loading: userloading, info: userData } = useRegistry();
  const dispatch = useAppDispatch();

  const queue = useAppSelector((state) => state.flowsheet.queue);

  // A settled WhoIsLive read: a successful response that isn't mid-refetch.
  // isLoading (behind useShowControl's `loading`) is true only on the first
  // fetch, so it doesn't cover the invalidate→refetch gaps (e.g. an
  // optimistic-miss during go-live) where WhoIsLive momentarily reads
  // off-air; isFetching does. (#644)
  const { whoIsLiveSettled } = useWhoIsLiveQuery(undefined, {
    skip: !userData || userloading,
    pollingInterval: 60000,
    selectFromResult: ({ isSuccess, isFetching }) => ({
      whoIsLiveSettled: isSuccess && !isFetching,
    }),
  });

  // Load queue from localStorage on mount
  useEffect(() => {
    dispatch(flowsheetSlice.actions.loadQueue());
  }, [dispatch]); // Only run on mount

  // True when the previous settled WhoIsLive read was also off-air. A single
  // settled off-air read can be stale — right after joinShow fulfills, the
  // invalidation refetch can land before the backend registers the DJ — so
  // clearing requires two consecutive settled off-air reads. (#644)
  const confirmedOffAir = useRef(false);
  // Whether a signed-in user has been observed (drives the logout clear).
  const hadUser = useRef(false);

  // On logout the WhoIsLive subscription is skipped (and useRegistry reports
  // loading whenever unauthenticated), so the settled gate below can never
  // fire — clear directly on the signed-in → signed-out transition. (#644)
  useEffect(() => {
    if (userData) {
      hadUser.current = true;
      return;
    }
    if (hadUser.current) {
      hadUser.current = false;
      confirmedOffAir.current = false;
      dispatch(flowsheetSlice.actions.clearQueue());
    }
  }, [userData, dispatch]);

  // Clear the queue only when WhoIsLive has settled off-air twice in a row —
  // never during a transient refetch or a single stale post-join read. (#644)
  useEffect(() => {
    if (!whoIsLiveSettled) return;
    if (!live && confirmedOffAir.current && queue.length > 0) {
      dispatch(flowsheetSlice.actions.clearQueue());
    }
    confirmedOffAir.current = !live;
  }, [whoIsLiveSettled, live, queue.length, dispatch]);

  const addToQueue = useCallback(
    (entry: FlowsheetQuery) => {
      if (!live) {
        return;
      }

      dispatch(flowsheetSlice.actions.addToQueue(entry));
    },
    [dispatch, live]
  );

  const removeFromQueue = useCallback(
    (entry: number) => {
      if (!live) {
        return;
      }

      dispatch(flowsheetSlice.actions.removeFromQueue(entry));
    },
    [dispatch, live]
  );

  return {
    queue,
    addToQueue,
    removeFromQueue,
    loading,
  };
};

export const useFlowsheetSubmit = () => {
  // Ref drives the submit-path decision (synchronous read); the state mirror
  // drives the button color/icon. Without the ref, a fast Ctrl+Enter races
  // the form's implicit submit and lands the entry in the flowsheet because
  // React hasn't committed setCtrlKeyPressed by the time handleSubmit fires.
  const queueModifierRef = useRef(false);
  const [ctrlKeyPressed, setCtrlKeyPressed] = useState(false);

  const { addToQueue } = useQueue();
  const { addToFlowsheet } = useFlowsheet();
  const dispatch = useAppDispatch();

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === "Control" || e.key === "Meta") {
      queueModifierRef.current = true;
      setCtrlKeyPressed(true);
    }
  }, []);

  const handleKeyUp = useCallback((e: KeyboardEvent) => {
    if (e.key === "Control" || e.key === "Meta") {
      queueModifierRef.current = false;
      setCtrlKeyPressed(false);
    }
  }, []);

  const { searchResults: binResults } = useBinResults();
  const { searchResults: catalogResults } = useCatalogFlowsheetSearch();
  const { searchResults: rotationResults } = useRotationFlowsheetSearch();

  const selectedResult = useAppSelector(
    flowsheetSlice.selectors.getSelectedResult
  );

  const flowSheetRawQuery = useAppSelector(
    flowsheetSlice.selectors.getSearchQuery
  );

  const { results: rawLmlResults } = useLmlLibrarySearch({
    artist: flowSheetRawQuery.artist,
    album: flowSheetRawQuery.album,
  });

  // Deduplicate LML results against the other three sources
  const lmlResults = useMemo(() => {
    const seen = new Set<number>();
    for (const r of binResults) seen.add(r.id);
    for (const r of rotationResults) seen.add(r.id);
    for (const r of catalogResults) seen.add(r.id);
    return rawLmlResults.filter((r) => !seen.has(r.id));
  }, [binResults, rotationResults, catalogResults, rawLmlResults]);

  // Memoized collection of all VISIBLE search results. Must mirror the capped
  // index space (FlowsheetSearchResults offsets + FlowsheetSearchbar nav
  // bound): submitting through the full lists would map a visible index onto a
  // different, unseen album whenever an earlier section is truncated. (#657)
  const allSearchResults = useMemo(() => [
    ...binResults.slice(0, MAX_VISIBLE_RESULTS),
    ...rotationResults.slice(0, MAX_VISIBLE_RESULTS),
    ...catalogResults.slice(0, MAX_VISIBLE_RESULTS),
    ...lmlResults.slice(0, MAX_VISIBLE_RESULTS),
  ], [binResults, rotationResults, catalogResults, lmlResults]);

  // Memoized selected entry (null if creating new)
  const selectedEntry = useMemo(() => {
    if (selectedResult === 0) return null;
    return allSearchResults[selectedResult - 1] ?? null;
  }, [selectedResult, allSearchResults]);

  // Memoized calculation of the selected result data
  const selectedResultData = useMemo<FlowsheetQuery>(() => {
    if (selectedResult == 0 || !selectedEntry) {
      // User is creating a new entry manually (or in rotation mode)
      return {
        song: flowSheetRawQuery.song as string,
        artist: flowSheetRawQuery.artist as string,
        album: flowSheetRawQuery.album as string,
        label: flowSheetRawQuery.label as string,
        album_id: flowSheetRawQuery.album_id,
        rotation_id: flowSheetRawQuery.rotation_id,
        rotation_bin: flowSheetRawQuery.rotation_bin,
        track_position: flowSheetRawQuery.track_position,
        request: flowSheetRawQuery.request,
      };
    } else {
      // User has selected a result from the search
      // Use result values if available, otherwise fall back to user edits
      return {
        song: flowSheetRawQuery.song as string,
        artist: selectedEntry.artist?.name || flowSheetRawQuery.artist as string,
        album: selectedEntry.title || flowSheetRawQuery.album as string,
        label: selectedEntry.label || flowSheetRawQuery.label as string,
        album_id: selectedEntry.id ?? undefined,
        rotation_bin: selectedEntry.rotation_bin ?? undefined,
        rotation_id: selectedEntry.rotation_id ?? undefined,
        track_position: flowSheetRawQuery.track_position,
        request: flowSheetRawQuery.request,
      };
    }
  }, [selectedResult, selectedEntry, flowSheetRawQuery]);

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      // Guard required fields here because clicking a search result row
      // bypasses the form's HTML5 `required` validation (the row's onClick
      // calls handleSubmit directly instead of submitting the form).
      if (!(selectedResultData.song ?? "").trim()) {
        toast.error("Song title is required");
        return;
      }
      if (queueModifierRef.current) {
        addToQueue(selectedResultData);
        dispatch(flowsheetSlice.actions.resetSearch());
        return;
      }
      try {
        await addToFlowsheet(convertQueryToSubmission(selectedResultData));
        dispatch(flowsheetSlice.actions.resetSearch());
      } catch (err) {
        const message =
          err &&
          typeof err === "object" &&
          "data" in err &&
          err.data &&
          typeof err.data === "object" &&
          "message" in err.data &&
          typeof (err.data as { message: unknown }).message === "string"
            ? (err.data as { message: string }).message
            : err instanceof Error
              ? err.message
              : "Could not add to flowsheet";
        toast.error(message);
      }
    },
    [
      addToFlowsheet,
      addToQueue,
      selectedResultData,
      dispatch,
    ]
  );

  // Combine both keyboard listeners into one effect
  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("keyup", handleKeyUp);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("keyup", handleKeyUp);
    };
  }, [handleKeyDown, handleKeyUp]);

  return {
    ctrlKeyPressed,
    handleSubmit,
    binResults,
    catalogResults,
    rotationResults,
    lmlResults,
    selectedResultData,
    selectedEntry,
  };
};
