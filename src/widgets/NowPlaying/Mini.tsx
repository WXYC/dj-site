"use client";

import {
  FlowsheetEntry,
  OnAirDJResponse,
} from "@/lib/features/flowsheet/types";
import { Headset, Pause, PlayArrow } from "@mui/icons-material";
import {
  Card,
  CardContent,
  CardOverflow,
  Chip,
  IconButton,
  Stack,
} from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import { MutableRefObject, RefObject } from "react";
import AlbumArtAndIcons from "./AlbumArtAndIcons";
import EntryText from "./EntryText";
import { GradientAudioVisualizer } from "./GradientAudioVisualizer";

export default function NowPlayingMini({
  entry,
  live,
  onAirDJs,
  audioRef,
  isPlaying,
  onTogglePlay,
  audioContext,
  analyserNode,
  animationFrameRef,
}: {
  entry?: FlowsheetEntry;
  live: boolean;
  onAirDJs?: OnAirDJResponse[];
  audioRef: RefObject<HTMLAudioElement>;
  isPlaying: boolean;
  onTogglePlay: () => void;
  audioContext: AudioContext | null;
  analyserNode: AnalyserNode | null;
  animationFrameRef: MutableRefObject<number | null>;
}) {
  const { mode } = useColorScheme();
  const overlayColor = mode === "light" ? "white" : "neutral.800";

  return (
    <Card
      orientation="horizontal"
      variant="outlined"
      sx={{
        overflow: "hidden",
        width: "100%",
        maxWidth: "100%",
        minWidth: 0,
      }}
    >
      <GradientAudioVisualizer
        audioRef={audioRef}
        isPlaying={isPlaying}
        audioContext={audioContext}
        analyserNode={analyserNode}
        overlayColor={overlayColor}
        animationFrameRef={animationFrameRef}
      />
      <CardContent sx={{
        maxWidth: "calc(100px + 1.5rem)"
      }}>
        <AlbumArtAndIcons entry={entry} />
        <IconButton
          aria-label={isPlaying ? "Pause audio" : "Play audio"}
          size="sm"
          variant="solid"
          color="danger"
          sx={{
            position: "absolute",
            zIndex: 2,
            borderRadius: "50%",
            left: "calc(100px - 0.2rem)",
            bottom: "1.5rem",
            transform: "translateY(50%)",
          }}
          onClick={onTogglePlay}
        >
          {isPlaying ? <Pause /> : <PlayArrow />}
        </IconButton>
      </CardContent>
      <CardContent sx={{ justifyContent: "space-between", minWidth: 0, flex: 1, overflow: "hidden" }}>
        <EntryText entry={entry} />
        <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap: "wrap" }}>
          {onAirDJs?.map((dj) => (
            <Chip key={dj.dj_name} variant="soft" startDecorator={<Headset />}>
              DJ {dj.dj_name}
            </Chip>
          ))}
        </Stack>
      </CardContent>
      <CardOverflow
        variant="soft"
        color={live ? "primary" : "neutral"}
        sx={{
          px: 0.2,
          writingMode: "vertical-rl",
          justifyContent: "center",
          fontSize: "xs",
          fontWeight: "xl",
          letterSpacing: "1px",
          textTransform: "uppercase",
          borderLeft: "1px solid",
          borderColor: "divider",
          zIndex: 2,
        }}
      >
        {live ? "LIVE" : "OFF AIR"}
      </CardOverflow>
    </Card>
  );
}
