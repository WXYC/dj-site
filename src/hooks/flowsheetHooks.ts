"use client";

import {
  useAddToFlowsheetMutation,
  useGetEntriesQuery,
  useJoinShowMutation,
  useLeaveShowMutation,
  useRemoveFromFlowsheetMutation,
  useWhoIsLiveQuery,
} from "@/lib/features/flowsheet/api";
import { flowsheetSlice } from "@/lib/features/flowsheet/frontend";
import {
  FlowsheetSearchProperty,
  FlowsheetSubmissionParams,
} from "@/lib/features/flowsheet/types";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { useEffect, useState } from "react";
import { useRegistry } from "./authenticationHooks";

export const useShowControl = () => {
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
        liveList !== undefined &&
          liveList?.length !== 0 &&
          liveList.some((dj) => dj.id === userData?.id)
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
        limit: 1
      })
    );
    goLiveFunction({ dj_id: userData.id });
  };

  const leave = () => {
    if (!userData || userData.id === undefined || userloading) {
      return;
    }

    dispatch(
      flowsheetSlice.actions.setPagination({
        page: 0,
        limit: 1
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

export const useFlowsheet = () => {
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
          limit: 1
        })
      );
    } else if (addToFlowsheetResult.isSuccess) {
      dispatch(
        flowsheetSlice.actions.setPagination({
          page: 0,
          limit: 1
        })
      );
    }
  }, [addToFlowsheetResult]);

  const [deletedId, setDeletedId] = useState(0);
  const [removeFromFlowsheet, removeFromFlowsheetResult] =
    useRemoveFromFlowsheetMutation();
  const removeFromFlowsheetCallback = (entry: number) => {
    if (!userData || userData.id === undefined || userloading) {
      return;
    }
    removeFromFlowsheet(entry);
  };

  useEffect(() => {
    if (removeFromFlowsheetResult.isSuccess) {
      dispatch(
        flowsheetSlice.actions.setPagination({
          page: 0,
          limit: Math.max(1, ...(data?.map((entry) => entry.play_order) ?? [1])) - deletedId + 1,
          deleted: deletedId,
        })
      );
    }
  }, [removeFromFlowsheetResult, deletedId]);

  const removeFromQueue = (entry: number) =>
    dispatch(flowsheetSlice.actions.removeFromQueue(entry));

  return {
    entries: data,
    addToFlowsheet: addToFlowsheetCallback,
    removeFromFlowsheet: removeFromFlowsheetCallback,
    removeFromQueue,
    loading: isLoading || userloading,
    isSuccess,
    isError,
  };
};
