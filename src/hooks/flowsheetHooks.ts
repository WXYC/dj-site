"use client";

import {
  useGetEntriesQuery,
  useJoinShowMutation,
  useLeaveShowMutation,
  useWhoIsLiveQuery,
} from "@/lib/features/flowsheet/api";
import { flowsheetSlice } from "@/lib/features/flowsheet/frontend";
import { FlowsheetQuery } from "@/lib/features/flowsheet/types";
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

  const { data, isLoading: entriesLoading, isSuccess, isError } = useGetEntriesQuery(
    undefined,
    {
      skip: !userData || userloading,
    }
  );

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

  const goLive = () => {
    if (!userData || userData.id === undefined || userloading) {
      return;
    }

    goLiveFunction({ dj_id: userData.id });
  };

  const leave = () => {
    if (!userData || userData.id === undefined || userloading) {
      return;
    }

    leaveFunction({ dj_id: userData.id });
  };

  const autoplay = useAppSelector((state) => state.flowsheet.autoplay);
  const dispatch = useAppDispatch();
  const setAutoPlay = (autoplay: boolean) => {
    dispatch(flowsheetSlice.actions.setAutoplay(autoplay));
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
  const searchQuery = useAppSelector((state) => state.flowsheet.search.query);
  const setSearchProperty = (name: keyof Omit<FlowsheetQuery, "request">, value: string) => {
    dispatch(flowsheetSlice.actions.setSearchProperty({ name, value }));
  };

  return {
    live,
    loading,
    searchOpen,
    setSearchOpen,
    searchQuery,
    setSearchProperty,
  };
};

export const useFlowsheet = () => {
  const { loading: userloading, info: userData } = useRegistry();

  const { data, isLoading, isSuccess, isError } = useGetEntriesQuery(
    undefined,
    {
      skip: !userData || userloading,
    }
  );

  useEffect(() => {
    console.log(data);
  }, [data]);

  return {
    entries: data,
    loading: isLoading || userloading,
    isSuccess,
    isError,
  };
};
