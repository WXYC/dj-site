"use client";

import {
  flowsheetApi,
  useAddToFlowsheetMutation,
  useGetEntriesQuery,
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
  FlowsheetEntry,
  FlowsheetQuery,
  FlowsheetSearchProperty,
  FlowsheetSubmissionParams,
  FlowsheetUpdateParams,
  isFlowsheetEndShowEntry,
  isFlowsheetStartShowEntry,
} from "@/lib/features/flowsheet/types";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRegistry } from "./authenticationHooks";
import { useBinResults } from "./binHooks";
import {
  useCatalogFlowsheetSearch,
  useRotationFlowsheetSearch,
} from "./catalogHooks";

export const useShowControl = () => {
  const { loading: userloading, info: userData } = useRegistry();

  const {
    data: liveList,
    isLoading: loadingLiveList,
  } = useWhoIsLiveQuery(undefined, {
    skip: !userData || userloading,
    pollingInterval: 60000, // Poll every 60 seconds to keep live status updated
  });

  const pagination = useAppSelector(flowsheetSlice.selectors.getPagination);
  const {
    data,
    isLoading: entriesLoading,
    isSuccess,
  } = useGetEntriesQuery(pagination, {
    skip: !userData || userloading,
    pollingInterval: 60000, // Poll every 60 seconds to keep flowsheet updated
  });

  // Calculate derived state during render - no useState/useEffect needed
  const currentShow = useMemo(() => {
    return isSuccess && data && data.length > 0 ? data[0].show_id : -1;
  }, [data, isSuccess]);

  const live = useMemo(() => {
    if (!isSuccess) return false;
    return (
      liveList?.djs !== undefined &&
      liveList?.djs.length !== 0 &&
      liveList.djs.some((dj) => dj.id === userData?.id)
    );
  }, [liveList, isSuccess, userData?.id]);

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

    dispatch(
      flowsheetSlice.actions.setPagination({
        page: 0,
        limit: 1,
      })
    );
    goLiveFunction({ dj_id: userData.id });
  };

  const leave = () => {
    if (!userData || userData.id === undefined || userloading) {
      return;
    }

    // Clear the queue when ending the show
    dispatch(flowsheetSlice.actions.clearQueue());
    
    dispatch(
      flowsheetSlice.actions.setPagination({
        page: 0,
        limit: 1,
      })
    );
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
      leavingResult.isLoading ||
      entriesLoading,
    currentShow,
    goLive,
    leave,
  };
};

export const useFlowsheetSearch = () => {
  const { live, loading } = useShowControl();

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

  const pagination = useAppSelector(flowsheetSlice.selectors.getPagination);
  const { data, isLoading, isSuccess, isError } = useGetEntriesQuery(
    pagination,
    {
      skip: !userData || userloading,
      pollingInterval: 60000, // Poll every 60 seconds to keep flowsheet updated
    }
  );

  const [addToFlowsheet] = useAddToFlowsheetMutation();
  const addToFlowsheetCallback = (arg: FlowsheetSubmissionParams) => {
    if (!userData || userData.id === undefined || userloading) {
      return Promise.reject('User not logged in');
    }

    // Return the promise so callers can wait for completion
    return addToFlowsheet(arg).unwrap().then((result) => {
      // Dispatch after successful mutation
      dispatch(
        flowsheetSlice.actions.setPagination({
          page: 0,
          limit: 1,
        })
      );
      return result;
    });
  };

  const [removeFromFlowsheet] = useRemoveFromFlowsheetMutation();
  const removeFromFlowsheetCallback = (entry: number) => {
    if (!userData || userData.id === undefined || userloading) {
      return;
    }
    dispatch(
      flowsheetApi.util.updateQueryData("getEntries", pagination, (draft) => {
        const index = draft.findIndex((item) => item.id === entry);
        if (index !== -1) {
          draft.splice(index, 1);
        }
      })
    );
    removeFromFlowsheet(entry);
  };

  const [updateFlowsheetEntry] =
    useUpdateFlowsheetMutation();
  const updateFlowsheet = (updateData: FlowsheetUpdateParams) => {
    if (!userData || userData.id === undefined || userloading) {
      return;
    }
    dispatch(
      flowsheetApi.util.updateQueryData("getEntries", pagination, (draft) => {
        const index = draft.findIndex(
          (item) => item.id === updateData.entry_id
        );
        if (index !== -1) {
          Object.assign(draft[index], updateData.data);
        }
      })
    );
    updateFlowsheetEntry(updateData);
  };

  const removeFromQueue = (entry: number) =>
    dispatch(flowsheetSlice.actions.removeFromQueue(entry));

  const { currentShow, live } = useShowControl();

  // Calculate derived state during render instead of useEffect + Redux
  const currentShowEntries = useMemo(() => {
    if (currentShow === -1 || !live || !data) return [];
    return data.filter(
      (entry) =>
        entry.show_id === currentShow &&
        !isFlowsheetStartShowEntry(entry) &&
        !isFlowsheetEndShowEntry(entry)
    );
  }, [data, currentShow, live]);

  const setCurrentShowEntries = (entries: FlowsheetEntry[]) => {
    dispatch(flowsheetSlice.actions.setCurrentShowEntries(entries));
  };

  const lastShowsEntries = useMemo(() => {
    if (!data) return [];
    return live
      ? data.filter(
          (entry) =>
            entry.show_id !== currentShow ||
            isFlowsheetStartShowEntry(entry) ||
            isFlowsheetEndShowEntry(entry)
        )
      : data;
  }, [data, live, currentShow]);

  const [switchBackendEntries] =
    useSwitchEntriesMutation();

  const switchEntries = useCallback(
    async (entry: FlowsheetEntry) => {
      if (!userData?.id || userloading) return;

      const newLocation = currentShowEntries.findIndex(
        (e) => e.id === entry.id
      );

      const swappedWith = data?.[newLocation];

      if (!swappedWith) return;

      try {
        switchBackendEntries({
          entry_id: entry.id,
          new_position: swappedWith.play_order!,
        }).then(() => {
          dispatch(
            flowsheetSlice.actions.setPagination({
              page: 0,
              limit: currentShowEntries.length,
            })
          );
        });
      } catch (err) {
        console.error("Failed to switch entries:", err);
      }
    },
    [
      userData?.id,
      userloading,
      data,
      switchBackendEntries,
      currentShowEntries,
      dispatch,
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
    loading: isLoading || userloading || !data,
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
    () => {
      if (ctrlKeyPressed) {
        addToQueue(selectedResultData);
      } else {
        addToFlowsheet(convertQueryToSubmission(selectedResultData));
      }

      // Close the search bar after submission
      dispatch(flowsheetSlice.actions.resetSearch());
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
