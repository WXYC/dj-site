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
import { useRef, useState } from "react";
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
}: {
  entry?: FlowsheetEntry;
  live: boolean;
  onAirDJ?: string;
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
      variant="outlined"
      sx={{
        width: width || "100%",
        height: height || "100%",
        minWidth: "350px",
        minHeight: "150px",
      }}
    >
      <CardOverflow>
        <AspectRatio ratio="2.5" variant="plain">
          <GradientAudioVisualizer
            src="https://audio-mp3.ibiblio.org/wxyc.mp3"
            ref={playRef}
          />
        </AspectRatio>
        <IconButton
          aria-label="Like minimal photography"
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
          onClick={toggle}
        >
          {playing ? <Pause /> : <PlayArrow />}
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
