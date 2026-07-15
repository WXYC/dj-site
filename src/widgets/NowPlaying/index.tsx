"use client";

import {
  useGetNowPlayingQuery,
  useWhoIsLiveQuery,
} from "@/lib/features/flowsheet/api";
import { useEffect, useRef, useState } from "react";
import { useFlowsheetPollingInterval } from "@/src/hooks/useSSEConnection";
import NowPlayingMain from "./Main";
import NowPlayingMini from "./Mini";

export type NowPlayingWidgetProps = {
  mini: boolean;
};

const AUDIO_SRC = "https://audio-mp3.ibiblio.org/wxyc.mp3";

// `createMediaElementSource` may be called at most ONCE per HTMLMediaElement for
// the element's lifetime; a second call throws InvalidStateError. Under React
// Strict Mode (or any remount) the init effect runs twice on the same element,
// so we cache the whole audio graph per element and reuse it instead of
// re-creating — and we never close the context, since a closed context would
// leave the element permanently routed to dead output. (dj-site#634)
type NowPlayingAudioGraph = {
  context: AudioContext;
  analyser: AnalyserNode;
  source: MediaElementAudioSourceNode;
};
const audioGraphCache = new WeakMap<HTMLMediaElement, NowPlayingAudioGraph>();

export default function NowPlaying({ mini = false }: NowPlayingWidgetProps) {
  // Single persistent audio element
  const audioRef = useRef<HTMLAudioElement>(null);

  // AudioContext / AnalyserNode live in state (not refs) so the children
  // re-render once the graph is wired up; refs wouldn't trigger the re-render
  // and the visualizer would receive null until an unrelated update. (#634)
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);
  const [analyserNode, setAnalyserNode] = useState<AnalyserNode | null>(null);
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

  const nowPlayingPollingInterval = useFlowsheetPollingInterval();

  const {
    data: latestEntry,
    isLoading: latestEntryLoading,
    isError: latestEntryError,
  } = useGetNowPlayingQuery(undefined, {
    pollingInterval: nowPlayingPollingInterval,
    // Don't keep hitting the backend on a hidden/blurred tab. (#634)
    skipPollingIfUnfocused: true,
  });

  // Initialize (or reuse) the AudioContext and AnalyserNode for this element.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    let graph = audioGraphCache.get(audio);
    if (!graph) {
      try {
        const ctx = new (window.AudioContext ||
          (window as any).webkitAudioContext)();
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 512;

        // Only reachable once per element — reuse via the cache thereafter, so
        // a Strict Mode remount never calls createMediaElementSource twice.
        const source = ctx.createMediaElementSource(audio);
        source.connect(analyser);
        analyser.connect(ctx.destination);

        graph = { context: ctx, analyser, source };
        audioGraphCache.set(audio, graph);
      } catch (error) {
        console.error("Failed to create audio context:", error);
        return;
      }
    }

    setAudioContext(graph.context);
    setAnalyserNode(graph.analyser);
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
      audio.removeAttribute("src");
      audio.load();
    } else {
      audio.src = AUDIO_SRC;
      audio.play().catch((error) => {
        console.error("Failed to play audio:", error);
      });
    }
  };

  // Cleanup on unmount: stop the stream. The AudioContext / source graph are
  // intentionally NOT closed here — they're cached per element and reused on
  // remount (closing would mute the element forever). The animation frame is
  // owned and cancelled by GradientAudioVisualizer's own effect. (#634)
  useEffect(() => {
    return () => {
      const audio = audioRef.current;
      if (audio) {
        audio.pause();
        audio.removeAttribute("src");
        audio.load();
      }
    };
  }, []);

  return (
    <>
      <audio
        id="now-playing-music"
        crossOrigin="anonymous"
        ref={audioRef}
        preload="none"
        playsInline
        style={{ display: "none" }}
      />
      {mini ? (
        <NowPlayingMini
          entry={latestEntry ?? undefined}
          live={live}
          onAirDJs={djsOnAirData?.djs}
          audioRef={audioRef}
          isPlaying={isPlaying}
          onTogglePlay={onTogglePlay}
          audioContext={audioContext}
          analyserNode={analyserNode}
          animationFrameRef={animationFrameRef}
        />
      ) : (
        <NowPlayingMain
          entry={latestEntry ?? undefined}
          live={live}
          onAirDJ={onAirDJ}
          loading={djLoading}
          audioRef={audioRef}
          isPlaying={isPlaying}
          onTogglePlay={onTogglePlay}
          audioContext={audioContext}
          analyserNode={analyserNode}
          animationFrameRef={animationFrameRef}
        />
      )}
    </>
  );
}
