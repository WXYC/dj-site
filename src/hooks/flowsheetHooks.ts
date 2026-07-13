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
import { compareEntriesNewestFirst } from "@/lib/features/flowsheet/infinite-cache";
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
import {
  useFlowsheetResults,
} from "@/src/components/experiences/modern/flowsheet/Search/FlowsheetSearchProvider";
import { useDocumentKeydown } from "./useDocumentKeydown";
import { AlbumEntry } from "@/lib/features/catalog/types";

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

  const {
    data: liveList,
    isLoading: loadingLiveList,
  } = useWhoIsLiveQuery(undefined, {
    skip: !userData || userloading,
    pollingInterval: 60000, // Poll every 60 seconds to keep live status updated
  });

  const {
    data: infiniteData,
    isSuccess: entriesQuerySuccess,
  } = useGetInfiniteEntriesInfiniteQuery(undefined, {
    skip: !userData || userloading,
    pollingInterval: flowsheetPollingInterval,
  });

  // Flatten all pages into a single sorted array
  const allEntries = useMemo(() => {
    if (!infiniteData?.pages) return [];
    const map = new Map<number, FlowsheetEntry>();
    infiniteData.pages.flat().forEach((entry) => map.set(entry.id, entry));
    return Array.from(map.values()).sort(compareEntriesNewestFirst);
  }, [infiniteData?.pages]);

  // Calculate derived state during render - no useState/useEffect needed
  const currentShow = useMemo(() => {
    return entriesQuerySuccess && allEntries.length > 0
      ? allEntries[0].show_id
      : -1;
  }, [allEntries, entriesQuerySuccess]);

  const live = useMemo(() => {
    return (
      liveList?.djs !== undefined &&
      liveList?.djs.length !== 0 &&
      liveList.djs.some((dj) => dj.id === userData?.id)
    );
  }, [liveList, userData?.id]);

  const isSaving = useAppSelector(selectFlowsheetMutationPending);

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
    const payload: { dj_id: string; dj_name_override?: string } = {
      dj_id: userData.id,
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
    isSaving,
    currentShow,
    goLive,
    leave,
  };
};

export const useFlowsheetSearch = () => {
  const { live, loading, isSaving } = useShowControl();

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
  const { binResults, rotationResults, catalogResults, lmlResults } =
    useFlowsheetResults();

  const allSearchResults = useMemo(
    () => [...binResults, ...rotationResults, ...catalogResults, ...lmlResults],
    [binResults, rotationResults, catalogResults, lmlResults]
  );

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
  const dispatch = useAppDispatch();
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

  const [addToFlowsheet] = useAddToFlowsheetMutation();
  // Stable identity so consumers (e.g. the Mail Bin's per-row action memos)
  // can hold it in dependency arrays without recomputing every render.
  const addToFlowsheetCallback = useCallback(
    (arg: FlowsheetSubmissionParams) => {
      if (!userData || userData.id === undefined || userloading) {
        return Promise.reject('User not logged in');
      }

      // Tag invalidation from the mutation handles refetching
      return addToFlowsheet(arg).unwrap();
    },
    [addToFlowsheet, userData, userloading]
  );

  const [removeFromFlowsheet, _] = useRemoveFromFlowsheetMutation();
  const removeFromFlowsheetCallback = (entry: number) => {
    if (!userData || userData.id === undefined || userloading) {
      return;
    }
    removeFromFlowsheet(entry);
  };

  const [updateFlowsheetEntry] = useUpdateFlowsheetMutation();
  const updateFlowsheet = (updateData: FlowsheetUpdateParams) => {
    if (!userData || userData.id === undefined || userloading) {
      return;
    }
    updateFlowsheetEntry(updateData);
  };

  const removeFromQueue = (entry: number) =>
    dispatch(flowsheetSlice.actions.removeFromQueue(entry));

  const { currentShow, live } = useShowControl();

  // Partition entries into current show vs previous shows.
  // All entries from the current show (including start/end markers) go into
  // currentShowEntries so that concatenation with lastShowsEntries preserves
  // strict id-DESC chronological order.
  const { current: currentShowEntries, previous: lastShowsEntries } = useMemo(
    () => partitionFlowsheetEntries(allEntries, currentShow, live),
    [allEntries, currentShow, live]
  );

  const setCurrentShowEntries = (entries: FlowsheetEntry[]) => {
    dispatch(flowsheetSlice.actions.setCurrentShowEntries(entries));
  };

  const [switchBackendEntries, switchBackendResult] =
    useSwitchEntriesMutation();

  // TODO: newLocation is an index into currentShowEntries but used as an index
  // into allEntries — these arrays have different lengths and contents. This is
  // safe only because drag-and-drop is currently disabled in the UI.
  const switchEntries = useCallback(
    async (entry: FlowsheetEntry) => {
      if (!userData?.id || userloading) return;

      const newLocation = currentShowEntries.findIndex(
        (e) => e.id === entry.id
      );

      const swappedWith = allEntries[newLocation];

      if (!swappedWith) return;

      try {
        // Tag invalidation from the mutation handles refetching
        await switchBackendEntries({
          entry_id: entry.id,
          new_position: swappedWith.play_order!,
        });
      } catch (err) {
        console.error("Failed to switch entries:", err);
      }
    },
    [
      userData?.id,
      userloading,
      allEntries,
      currentShow,
      switchBackendEntries,
      currentShowEntries,
    ]
  );

  return {
    entries: {
      current: currentShowEntries,
      previous: lastShowsEntries,
      setCurrentShowEntries,
      switchEntries,
    },
    addToFlowsheet: addToFlowsheetCallback,
    removeFromFlowsheet: removeFromFlowsheetCallback,
    updateFlowsheet,
    removeFromQueue,
    loading: isLoading || userloading,
    isFetching,
    hasNextPage,
    fetchNextPage,
    isSuccess,
    isError,
  };
};

export const useQueue = () => {
  const { live, loading } = useShowControl();
  const dispatch = useAppDispatch();

  const queue = useAppSelector((state) => state.flowsheet.queue);

  // Load queue from localStorage on mount
  useEffect(() => {
    dispatch(flowsheetSlice.actions.loadQueue());
  }, [dispatch]); // Only run on mount

  // Clear queue when user goes offline or is not live after loading completes
  useEffect(() => {
    if (!loading && !live && queue.length > 0) {
      dispatch(flowsheetSlice.actions.clearQueue());
    }
  }, [live, loading, queue.length, dispatch]);

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
  const queueModifierRef = useRef(false);
  const [ctrlKeyPressed, setCtrlKeyPressed] = useState(false);

  const { addToQueue } = useQueue();
  const { addToFlowsheet, removeFromFlowsheet } = useFlowsheet();
  const dispatch = useAppDispatch();

  useDocumentKeydown((e) => {
    if (e.key === "Control" || e.key === "Meta") {
      queueModifierRef.current = true;
      setCtrlKeyPressed(true);
    }
  });

  useEffect(() => {
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === "Control" || e.key === "Meta") {
        queueModifierRef.current = false;
        setCtrlKeyPressed(false);
      }
    };
    document.addEventListener("keyup", handleKeyUp);
    return () => document.removeEventListener("keyup", handleKeyUp);
  }, []);

  const { binResults, rotationResults, catalogResults, lmlResults } =
    useFlowsheetResults();

  const selectedResult = useAppSelector(
    flowsheetSlice.selectors.getSelectedResult
  );

  const allSearchResults = useMemo(
    () => [...binResults, ...rotationResults, ...catalogResults, ...lmlResults],
    [binResults, rotationResults, catalogResults, lmlResults]
  );

  // Memoized selected entry (null if creating new)
  const selectedEntry = useMemo(() => {
    if (selectedResult === 0) return null;
    return allSearchResults[selectedResult - 1] ?? null;
  }, [selectedResult, allSearchResults]);

  const flowSheetRawQuery = useAppSelector(
    flowsheetSlice.selectors.getSearchQuery
  );

  const selectedResultData = useMemo<FlowsheetQuery>(
    () =>
      buildSelectedResultData(
        selectedResult,
        selectedEntry,
        flowSheetRawQuery
      ),
    [selectedResult, selectedEntry, flowSheetRawQuery]
  );

  const handleSubmit = useCallback(
    async (e: FormEvent, committedQuery?: FlowsheetQuery) => {
      e.preventDefault();
      const query = committedQuery ?? flowSheetRawQuery;

      const data = buildSelectedResultData(
        selectedResult,
        selectedEntry,
        query
      );

      if (!(data.song ?? "").trim()) {
        toast.error("Song title is required");
        return;
      }

      if (queueModifierRef.current) {
        addToQueue(data);
        dispatch(flowsheetSlice.actions.resetSearch());
        return;
      }

      const draft = { ...data };
      dispatch(flowsheetSlice.actions.resetSearch());

      try {
        const created = await addToFlowsheet(convertQueryToSubmission(draft));
        toast("Added to flowsheet", {
          action: {
            label: "Undo",
            onClick: () => {
              if (created && typeof created === "object" && "id" in created) {
                removeFromFlowsheet(created.id as number);
              }
            },
          },
          duration: 5000,
        });
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
        toast.error(message, {
          action: {
            label: "Restore entry",
            onClick: () =>
              dispatch(flowsheetSlice.actions.restoreDraft(draft)),
          },
          duration: 10000,
        });
      }
    },
    [
      addToFlowsheet,
      addToQueue,
      selectedResult,
      selectedEntry,
      flowSheetRawQuery,
      dispatch,
      removeFromFlowsheet,
    ]
  );

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

function buildSelectedResultData(
  selectedResult: number,
  selectedEntry: AlbumEntry | null,
  flowSheetRawQuery: FlowsheetQuery
): FlowsheetQuery {
  if (selectedResult === 0 || !selectedEntry) {
    return {
      song: flowSheetRawQuery.song as string,
      artist: flowSheetRawQuery.artist as string,
      album: flowSheetRawQuery.album as string,
      label: flowSheetRawQuery.label as string,
      album_id: flowSheetRawQuery.album_id,
      rotation_id: flowSheetRawQuery.rotation_id,
      rotation_bin: flowSheetRawQuery.rotation_bin,
      track_position: flowSheetRawQuery.track_position,
      request: false,
    };
  }
  return {
    song: flowSheetRawQuery.song as string,
    artist: selectedEntry.artist?.name || (flowSheetRawQuery.artist as string),
    album: selectedEntry.title || (flowSheetRawQuery.album as string),
    label: selectedEntry.label || (flowSheetRawQuery.label as string),
    album_id: selectedEntry.id ?? undefined,
    rotation_bin: selectedEntry.rotation_bin ?? undefined,
    rotation_id: selectedEntry.rotation_id ?? undefined,
    track_position: flowSheetRawQuery.track_position,
    request: false,
  };
}
