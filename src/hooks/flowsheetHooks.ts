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
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useRegistry } from "./authenticationHooks";
import { useBinResults } from "./binHooks";
import {
  useCatalogFlowsheetSearch,
  useRotationFlowsheetSearch,
} from "./catalogHooks";

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
    pollingInterval: 60000, // Poll every 60 seconds to keep flowsheet updated
  });

  // Flatten all pages into a single sorted array
  const allEntries = useMemo(() => {
    if (!infiniteData?.pages) return [];
    const map = new Map<number, FlowsheetEntry>();
    infiniteData.pages.flat().forEach((entry) => map.set(entry.id, entry));
    return Array.from(map.values()).sort(
      (a, b) => b.id - a.id
    );
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

  const goLive = () => {
    if (!userData || userData.id === undefined || userloading) {
      return;
    }
    // Tag invalidation from the mutation handles refetching
    goLiveFunction({ dj_id: userData.id });
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
  const { searchResults: binResults } = useBinResults();
  const { searchResults: catalogResults } = useCatalogFlowsheetSearch();
  const { searchResults: rotationResults } = useRotationFlowsheetSearch();

  const allSearchResults = useMemo(() => [
    ...binResults,
    ...rotationResults,
    ...catalogResults,
  ], [binResults, rotationResults, catalogResults]);

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
    pollingInterval: 60000, // Poll every 60 seconds to keep flowsheet updated
  });

  // Flatten all pages into a single deduplicated, sorted array
  const allEntries = useMemo(() => {
    if (!infiniteData?.pages) return [];
    const map = new Map<number, FlowsheetEntry>();
    infiniteData.pages.flat().forEach((entry) => map.set(entry.id, entry));
    return Array.from(map.values()).sort(
      (a, b) => b.id - a.id
    );
  }, [infiniteData?.pages]);

  const [addToFlowsheet] = useAddToFlowsheetMutation();
  const addToFlowsheetCallback = (arg: FlowsheetSubmissionParams) => {
    if (!userData || userData.id === undefined || userloading) {
      return Promise.reject('User not logged in');
    }

    // Tag invalidation from the mutation handles refetching
    return addToFlowsheet(arg).unwrap();
  };

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
  const [ctrlKeyPressed, setCtrlKeyPressed] = useState(false);

  const { addToQueue } = useQueue();
  const { addToFlowsheet } = useFlowsheet();
  const dispatch = useAppDispatch();

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === "Control") {
      e.preventDefault();
      setCtrlKeyPressed(true);
    }
  }, []);

  const handleKeyUp = useCallback((e: KeyboardEvent) => {
    if (e.key === "Control") {
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

  // Memoized collection of all search results
  const allSearchResults = useMemo(() => [
    ...binResults,
    ...rotationResults,
    ...catalogResults,
  ], [binResults, rotationResults, catalogResults]);

  // Memoized selected entry (null if creating new)
  const selectedEntry = useMemo(() => {
    if (selectedResult === 0) return null;
    return allSearchResults[selectedResult - 1] ?? null;
  }, [selectedResult, allSearchResults]);

  // Memoized calculation of the selected result data
  const selectedResultData = useMemo<FlowsheetQuery>(() => {
    if (selectedResult == 0 || !selectedEntry) {
      // User is creating a new entry manually
      return {
        song: flowSheetRawQuery.song as string,
        artist: flowSheetRawQuery.artist as string,
        album: flowSheetRawQuery.album as string,
        label: flowSheetRawQuery.label as string,
        request: false,
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
        request: false,
      };
    }
  }, [selectedResult, selectedEntry, flowSheetRawQuery]);

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      if (ctrlKeyPressed) {
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
      ctrlKeyPressed,
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
    selectedResultData,
    selectedEntry,
  };
};
