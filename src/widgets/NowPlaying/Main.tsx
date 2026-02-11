"use client";

import { FlowsheetEntry } from "@/lib/features/flowsheet/types";
import { Pause, PlayArrow } from "@mui/icons-material";
import { Box, CircularProgress } from "@mui/joy";
import AspectRatio from "@mui/joy/AspectRatio";
import Card from "@mui/joy/Card";
import CardContent from "@mui/joy/CardContent";
import CardOverflow from "@mui/joy/CardOverflow";
import Divider from "@mui/joy/Divider";
import IconButton from "@mui/joy/IconButton";
import Typography from "@mui/joy/Typography";
import { RefObject } from "react";
import AlbumArtAndIcons from "./AlbumArtAndIcons";
import EntryText from "./EntryText";
import { GradientAudioVisualizer } from "./GradientAudioVisualizer";

export default function NowPlayingMain({
  width,
  height,
  entry,
  live,
  onAirDJ,
  loading,
  audioRef,
  isPlaying,
  onTogglePlay,
  audioContext,
  analyserNode,
  animationFrameRef,
}: {
  entry?: FlowsheetEntry;
  live: boolean;
  onAirDJ?: string;
  loading?: boolean;
  width?: number;
  height?: number;
  audioRef: RefObject<HTMLAudioElement>;
  isPlaying: boolean;
  onTogglePlay: () => void;
  audioContext: AudioContext | null;
  analyserNode: AnalyserNode | null;
  animationFrameRef: RefObject<number | null>;
}) {
  return (
    <Card
      variant="outlined"
      sx={{
        width: width || "100%",
        height: height || "100%",
        minWidth: 0,
        maxWidth: "100%",
        minHeight: "150px",
      }}
    >
      <CardOverflow>
        <AspectRatio ratio="2.5" variant="plain">
          <GradientAudioVisualizer
            audioRef={audioRef}
            isPlaying={isPlaying}
            audioContext={audioContext}
            analyserNode={analyserNode}
            animationFrameRef={animationFrameRef}
          />
        </AspectRatio>
        <IconButton
          aria-label={isPlaying ? "Pause audio" : "Play audio"}
          size="lg"
          variant="solid"
          color="danger"
          sx={{
            position: "absolute",
            zIndex: 2,
            borderRadius: "50%",
            right: "1rem",
            bottom: 0,
            transform: "translateY(50%)",
          }}
          onClick={onTogglePlay}
        >
          {isPlaying ? <Pause /> : <PlayArrow />}
        </IconButton>
        <Box
          sx={{
            position: "absolute",
            minWidth: "100px",
            right: "50%",
            bottom: "50%",
            transform: "translateX(50%) translateY(50%) scale(1.3)",
            display: "flex",
            justifyContent: "center",
            zIndex: 2,
          }}
        >
          <AlbumArtAndIcons entry={entry} />
        </Box>
      </CardOverflow>
      <CardContent>
        <EntryText entry={entry} />
      </CardContent>
      <CardOverflow variant="soft" color={live ? "primary" : "neutral"}>
        <Divider inset="context" />
        <CardContent orientation="horizontal">
          <Typography level="body-xs">{live ? "LIVE" : "OFF AIR"}</Typography>
          {(live || loading) && (
            <>
              <Divider orientation="vertical" />
              {loading ? (
                <CircularProgress
                  size="sm"
                  variant="solid"
                  color="neutral"
                  sx={{ "--CircularProgress-size": "15px" }}
                />
              ) : (
                <Typography level="body-xs">{onAirDJ}</Typography>
              )}
            </>
          )}
        </CardContent>
      </CardOverflow>
    </Card>
  );
}
