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
import { useRef, useState } from "react";
import AlbumArtAndIcons from "./AlbumArtAndIcons";
import EntryText from "./EntryText";
import { GradientAudioVisualizer } from "./GradientAudioVisualizer";

export default function NowPlayingMini({
  width,
  height,
  entry,
  live,
  onAirDJs,
  loading,
}: {
  entry?: FlowsheetEntry;
  isSong: boolean;
  live: boolean;
  onAirDJs?: OnAirDJResponse[];
  loading?: boolean;
  width?: number;
  height?: number;
}) {
  const playRef = useRef<{
    play: () => void;
    pause: () => void;
    readonly isPlaying: boolean;
  }>(null);

  const [playing, setPlaying] = useState(false); // ← drives the icon

  const toggle = () => {
    if (!playRef.current) return;

    if (playRef.current.isPlaying) {
      playRef.current.pause();
      setPlaying(false);
    } else {
      playRef.current.play();
      setPlaying(true);
    }
  };

  return (
    <Card
      orientation="horizontal"
      variant="outlined"
      sx={{
        overflow: "hidden",
      }}
    >
      <GradientAudioVisualizer
        src="https://audio-mp3.ibiblio.org/wxyc.mp3"
        ref={playRef}
        overlayColor="rgba(0, 0, 0, 0.8)"
      />
      <CardContent sx = {{
        maxWidth: "calc(100px + 1.5rem)"
      }}>
        <AlbumArtAndIcons entry={entry} />
        <IconButton
          aria-label={playing ? "Pause audio" : "Play audio"}
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
          onClick={toggle}
        >
          {playing ? <Pause /> : <PlayArrow />}
        </IconButton>
      </CardContent>
      <CardContent sx={{ justifyContent: "space-between" }}>
        <EntryText entry={entry} />
        <Stack direction="row" spacing={1} alignItems="center">
          {onAirDJs?.map((dj) => (
            <Chip variant="soft" startDecorator={<Headset />}>
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
