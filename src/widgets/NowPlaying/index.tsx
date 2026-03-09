"use client";

import {
  useGetNowPlayingQuery,
  useWhoIsLiveQuery,
} from "@/lib/features/flowsheet/api";
import { useEffect, useRef, useState } from "react";
import NowPlayingMain from "./Main";
import NowPlayingMini from "./Mini";

export type NowPlayingWidgetProps = {
  mini: boolean;
};

const AUDIO_SRC = "https://audio-mp3.ibiblio.org/wxyc.mp3";

export default function NowPlaying({ mini = false }: NowPlayingWidgetProps) {
  // Single persistent audio element
  const audioRef = useRef<HTMLAudioElement>(null);
  
  // Single persistent AudioContext and AnalyserNode
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserNodeRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  
  // Shared playing state
  const [isPlaying, setIsPlaying] = useState(false);

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

  // Initialize AudioContext and AnalyserNode once
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || audioContextRef.current) return;

    try {
      const ctx = new (window.AudioContext ||
        (window as any).webkitAudioContext)();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      
      const source = ctx.createMediaElementSource(audio);
      source.connect(analyser);
      analyser.connect(ctx.destination);
      
      audioContextRef.current = ctx;
      analyserNodeRef.current = analyser;
    } catch (error) {
      console.error("Failed to create audio context:", error);
    }
  }, []);

  // Set up audio event listeners for playing state
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => setIsPlaying(false);

    audio.addEventListener("play", handlePlay);
    audio.addEventListener("pause", handlePause);
    audio.addEventListener("ended", handleEnded);

    return () => {
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("pause", handlePause);
      audio.removeEventListener("ended", handleEnded);
    };
  }, []);

  // Toggle play/pause function
  const onTogglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play().catch((error) => {
        console.error("Failed to play audio:", error);
      });
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Cancel any animation frames
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }

      // Pause and cleanup audio
      const audio = audioRef.current;
      if (audio) {
        audio.pause();
        audio.src = "";
      }

      // Close audio context
      if (audioContextRef.current) {
        audioContextRef.current.close().catch((error) => {
          console.error("Error closing audio context:", error);
        });
        audioContextRef.current = null;
      }
      
      analyserNodeRef.current = null;
    };
  }, []);

  return (
    <>
      <audio
        id="now-playing-music"
        crossOrigin="anonymous"
        ref={audioRef}
        src={AUDIO_SRC}
        playsInline
        style={{ display: "none" }}
      />
      {mini ? (
        <NowPlayingMini
          entry={latestEntry}
          live={live}
          onAirDJs={djsOnAirData?.djs}
          audioRef={audioRef}
          isPlaying={isPlaying}
          onTogglePlay={onTogglePlay}
          audioContext={audioContextRef.current}
          analyserNode={analyserNodeRef.current}
          animationFrameRef={animationFrameRef}
        />
      ) : (
        <NowPlayingMain
          entry={latestEntry}
          live={live}
          onAirDJ={onAirDJ}
          loading={djLoading}
          audioRef={audioRef}
          isPlaying={isPlaying}
          onTogglePlay={onTogglePlay}
          audioContext={audioContextRef.current}
          analyserNode={analyserNodeRef.current}
          animationFrameRef={animationFrameRef}
        />
      )}
    </>
  );
}
