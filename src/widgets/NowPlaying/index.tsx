"use client";

import {
  useGetNowPlayingQuery,
  useWhoIsLiveQuery,
} from "@/lib/features/flowsheet/api";
import { useAlbumImages } from "@/src/hooks/applicationHooks";
import { useRef, useState } from "react";
import NowPlayingMain from "./Main";
import NowPlayingMini from "./Mini";

export type NowPlayingWidgetProps = {
  mini: boolean;
};

export default function NowPlaying({ mini = false }: NowPlayingWidgetProps) {
  const audioRef = useRef<HTMLAudioElement>(null);

  const {
    data: djsOnAirData,
    isLoading: djLoading,
    isError: djError,
  } = useWhoIsLiveQuery();

  const onAirDJ = djsOnAirData?.onAir;
  const live = onAirDJ !== undefined && onAirDJ !== "Off Air" && !djError;

  const {
    data: latestEntry,
    isLoading: latestEntryLoading,
    isError: latestEntryError,
  } = useGetNowPlayingQuery(undefined, {
    pollingInterval: 60000,
  });

  return (
    <>
      <audio id="now-playing-music" crossOrigin="anonymous" ref={audioRef} />
      {mini ? (
        <NowPlayingMini
        entry={latestEntry}
        live={live}
        onAirDJs={djsOnAirData?.djs}
        />
      ) : (
        <NowPlayingMain
          entry={latestEntry}
          live={live}
          onAirDJ={onAirDJ}
          loading={djLoading}
        />
      )}
    </>
  );
}
