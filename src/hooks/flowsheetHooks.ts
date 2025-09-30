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
import { toast } from "sonner";
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
import { useCallback, useEffect, useState } from "react";
import { useRegistry } from "./authenticationHooks";
import { useBinResults } from "./binHooks";
import {
  useCatalogFlowsheetSearch,
  useRotationFlowsheetSearch,
} from "./catalogHooks";
import { createAuthenticatedHooks } from "./createAuthenticatedHooks";

const _useShowControl = () => {
  const { loading: userloading, info: userData } = useRegistry();

  const [live, setLive] = useState(false);

  useEffect(() => {
    if (!userData || userData.id === undefined || userloading) {
      return;
    }
  }, [userData, userloading]);

  const {
    data: liveList,
    isLoading: loadingLiveList,
    isSuccess: liveListSuccess,
  } = useWhoIsLiveQuery(undefined, {
    skip: !userData || userloading,
  });

  const pagination = useAppSelector(flowsheetSlice.selectors.getPagination);
  const {
    data,
    isLoading: entriesLoading,
    isSuccess,
    isError,
  } = useGetEntriesQuery(pagination, {
    skip: !userData || userloading,
  });

  const [currentShow, setCurrentShow] = useState<number>(-1);
  useEffect(() => {
    if (isSuccess && data) {
      setCurrentShow(data[0].show_id);
    }
  }, [data, isSuccess]);

  useEffect(() => {
    if (isSuccess) {
      setLive(
        liveList?.djs !== undefined &&
          liveList?.djs.length !== 0 &&
          liveList.djs.some((dj) => dj.id === Number(userData?.id))
      );
    }
  }, [liveList, isSuccess]);

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
    goLiveFunction({ dj_id: Number(userData.id) });
  };

  const leave = () => {
    if (!userData || userData.id === undefined || userloading) {
      return;
    }

    dispatch(
      flowsheetSlice.actions.setPagination({
        page: 0,
        limit: 1,
      })
    );
    leaveFunction({ dj_id: Number(userData.id) });
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

export const useShowControl = createAuthenticatedHooks(_useShowControl);

export const useFlowsheetSearch = () => {
  const { live, loading } = useShowControl();

  const dispatch = useAppDispatch();
  const searchOpen = useAppSelector((state) => state.flowsheet.search.open);
  const setSearchOpen = (open: boolean) => {
    dispatch(flowsheetSlice.actions.setSearchOpen(open));
  };
  const resetSearch = () => dispatch(flowsheetSlice.actions.resetSearch());
  const searchQuery = useAppSelector((state) => state.flowsheet.search.query);
  const setSearchProperty = (name: FlowsheetSearchProperty, value: string) => {
    dispatch(flowsheetSlice.actions.setSearchProperty({ name, value }));
  };

  return {
    live,
    loading,
    searchOpen,
    setSearchOpen,
    resetSearch,
    searchQuery,
    setSearchProperty,
  };
};

const _useFlowsheet = () => {
  const { loading: userloading, info: userData } = useRegistry();
  const dispatch = useAppDispatch();

  const pagination = useAppSelector(flowsheetSlice.selectors.getPagination);
  const { data, isLoading, isSuccess, isError } = useGetEntriesQuery(
    pagination,
    {
      skip: !userData || userloading,
    }
  );

  const [addToFlowsheet, addToFlowsheetResult] = useAddToFlowsheetMutation();
  const addToFlowsheetCallback = (arg: FlowsheetSubmissionParams) => {
    if (!userData || userData.id === undefined || userloading) {
      return;
    }

    addToFlowsheet(arg);
  };

  useEffect(() => {
    if (addToFlowsheetResult.isLoading) {
      dispatch(
        flowsheetSlice.actions.setPagination({
          page: 0,
          limit: 1,
        })
      );
    } else if (addToFlowsheetResult.isSuccess) {
      dispatch(
        flowsheetSlice.actions.setPagination({
          page: 0,
          limit: 1,
        })
      );
    }
  }, [addToFlowsheetResult]);

  const [removeFromFlowsheet, _] = useRemoveFromFlowsheetMutation();
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

  const [updateFlowsheetEntry, updateFlowsheetResult] =
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

  const currentShowEntries = useAppSelector(
    flowsheetSlice.selectors.getCurrentShowEntries
  );
  const setCurrentShowEntries = (entries: FlowsheetEntry[]) => {
    dispatch(flowsheetSlice.actions.setCurrentShowEntries(entries));
  };

  useEffect(() => {
    if (currentShow === -1) return;

    setCurrentShowEntries(
      live
        ? data?.filter(
            (entry) =>
              entry.show_id == currentShow &&
              (!live ||
                (!isFlowsheetStartShowEntry(entry) &&
                  !isFlowsheetEndShowEntry(entry)))
          ) ?? []
        : []
    );
  }, [data, currentShow, dispatch, isSuccess, live]);

  const lastShowsEntries = live
    ? data?.filter(
        (entry) =>
          entry.show_id != currentShow ||
          isFlowsheetStartShowEntry(entry) ||
          isFlowsheetEndShowEntry(entry)
      ) ?? []
    : data ?? [];

  const [switchBackendEntries, switchBackendResult] =
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
        toast.error("Failed to switch entries. Please try again.");
      }
    },
    [
      userData?.id,
      userloading,
      data,
      currentShow,
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

export const useFlowsheet = createAuthenticatedHooks(_useFlowsheet);

export const useQueue = () => {
  const { live, loading } = useShowControl();
  const dispatch = useAppDispatch();

  const queue = useAppSelector((state) => state.flowsheet.queue);

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

  const handleSubmit = useCallback(
    (e: any) => {
      let data: FlowsheetQuery;
      if (selectedResult == 0) {
        data = {
          song: flowSheetRawQuery.song as string,
          artist: flowSheetRawQuery.artist as string,
          album: flowSheetRawQuery.album as string,
          label: flowSheetRawQuery.label as string,
          request: false,
        };
      } else {
        const collectedResults = [
          binResults,
          rotationResults,
          catalogResults,
        ].flat();
        // Debug logging - can be removed in production
        console.log("COLLECTED RESULTS", collectedResults);
        console.log("SELECTED RESULT", collectedResults[selectedResult - 1]);
        data = {
          song: flowSheetRawQuery.song as string,
          artist: collectedResults[selectedResult - 1].artist?.name ?? "",
          album: collectedResults[selectedResult - 1].title ?? "",
          label: collectedResults[selectedResult - 1].label ?? "",
          album_id: collectedResults[selectedResult - 1].id ?? undefined,
          play_freq:
            collectedResults[selectedResult - 1].play_freq ?? undefined,
          rotation_id:
            collectedResults[selectedResult - 1].rotation_id ?? undefined,
          request: false,
        };
      }

      if (ctrlKeyPressed) {
        addToQueue(data);
      } else {
        addToFlowsheet(convertQueryToSubmission(data));
      }
    },
    [
      handleKeyDown,
      handleKeyUp,
      ctrlKeyPressed,
      addToFlowsheet,
      addToQueue,
      selectedResult,
      flowSheetRawQuery,
      binResults,
      rotationResults,
      catalogResults,
    ]
  );

  useEffect(() => {
    document.removeEventListener("keydown", handleKeyDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleKeyDown]);

  useEffect(() => {
    document.removeEventListener("keyup", handleKeyUp);
    document.addEventListener("keyup", handleKeyUp);

    return () => {
      document.removeEventListener("keyup", handleKeyUp);
    };
  }, [handleKeyUp]);

  return {
    ctrlKeyPressed,
    handleSubmit,
    binResults,
    catalogResults,
    rotationResults,
  };
};
