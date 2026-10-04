"use client";

import {
  useGetNowPlayingQuery,
  useWhoIsLiveQuery,
} from "@/lib/features/flowsheet/api";
import {
  FlowsheetEntry,
  OnAirDJData,
} from "@/lib/features/flowsheet/types";
import { useFlowsheetPollingInterval } from "@/src/hooks/useSSEConnection";
import NowPlayingMain from "./Main";
import NowPlayingMini from "./Mini";

export type NowPlayingWidgetProps = {
  mini: boolean;
  // Server-rendered seeds for the public /live page so first paint shows the
  // on-air DJ and now-playing track instead of a spinner. Omitted elsewhere
  // (e.g. the Rightbar), where the widget keeps its client-fetched behavior.
  initialEntry?: FlowsheetEntry | null;
  initialOnAirData?: OnAirDJData;
};

/**
 * What is on air. Deliberately has no stream player: a station tab playing the
 * stream in the studio feeds the delayed broadcast back into the mic.
 */
export default function NowPlaying({
  mini = false,
  initialEntry,
  initialOnAirData,
}: NowPlayingWidgetProps) {
  const nowPlayingPollingInterval = useFlowsheetPollingInterval();

  const {
    data: whoIsLiveData,
    isLoading: whoIsLiveLoading,
    isError: djError,
  } = useWhoIsLiveQuery(undefined, {
    pollingInterval: nowPlayingPollingInterval,
    skipPollingIfUnfocused: true,
    refetchOnFocus: true,
  });

  // The client query owns this value once it resolves; before then fall back to
  // the server seed so the public page renders the on-air state on first paint.
  const onAirData = whoIsLiveData ?? initialOnAirData;
  const onAirDJ = onAirData?.onAir;
  // Liveness comes from the DJ list, not from the banner text: the off-air
  // label is also what a list of DJs with no on-air handles formats to, so
  // reading liveness out of the banner renders OFF AIR mid-show.
  const live = (onAirData?.djs.length ?? 0) > 0 && !djError;
  // Show today's spinner only while the query is loading AND no seed is present;
  // with a seed there is already content to render.
  const djLoading = whoIsLiveLoading && onAirData === undefined;

  const { data: nowPlayingData } = useGetNowPlayingQuery(undefined, {
    pollingInterval: nowPlayingPollingInterval,
    skipPollingIfUnfocused: true,
    refetchOnFocus: true,
  });

  // `data` is undefined only until the first client fetch resolves; once it
  // does (even to null = nothing playing) it owns the value. Seed from the
  // server-provided entry until then.
  const latestEntry =
    nowPlayingData !== undefined ? nowPlayingData : initialEntry;

  return mini ? (
    <NowPlayingMini
      entry={latestEntry ?? undefined}
      live={live}
      onAirDJs={onAirData?.djs}
    />
  ) : (
    <NowPlayingMain
      entry={latestEntry ?? undefined}
      live={live}
      onAirDJ={onAirDJ}
      loading={djLoading}
    />
  );
}
