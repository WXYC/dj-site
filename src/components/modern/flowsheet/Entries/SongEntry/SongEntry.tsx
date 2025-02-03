"use client";

import { FlowsheetSongEntry } from "@/lib/features/flowsheet/types";
import { useShowControl } from "@/src/hooks/flowsheetHooks";
import { getStyleForRotation } from "@/src/utilities/modern/rotationstyles";
import { AspectRatio, Badge, CircularProgress, Sheet, Stack } from "@mui/joy";
import { useState } from "react";
import FlowsheetEntryField from "./FlowsheetEntryField";

export default function SongEntry({
  playing,
  queue,
  entry,
}: {
  playing: boolean;
  queue: boolean;
  entry: FlowsheetSongEntry;
}) {
  const { live, autoplay, currentShow } = useShowControl();

  const [canClose, setCanClose] = useState(false);

  const editable = entry.show_id == currentShow;

  const [image, setImage] = useState<string>("/img/cassette.png");

  return (
    <Sheet
      //ref={entryClientRectRef}
      color={playing ? "primary" : "neutral"}
      variant={queue || !editable ? "outlined" : playing ? "solid" : "soft"}
      sx={{
        height: "60px",
        borderRadius: "md",
        mb: playing && autoplay ? "0.25rem" : "initial",
        "&::after":
          playing && autoplay
            ? {
                content: '""',
                bgcolor:
                  "var(--joy-palette-primary-solidBg, var(--joy-palette-primary-500, #096BDE))",
                position: "absolute",
                bottom: "-0.25rem",
                top: "calc(100% - 1rem)",
                zIndex: -1,
                borderBottomRightRadius: "0.7rem",
                borderBottomLeftRadius: "0.7rem",
                left: 0,
                right: 0,
              }
            : {},
      }}
      onMouseOver={() => setCanClose(editable && live)}
      onMouseLeave={() => setCanClose(false)}
    >
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        spacing={1}
        sx={{
          height: "100%",
          p: 1,
          pr: 2,
        }}
      >
        <Badge
          size="sm"
          badgeContent={entry.rotation ?? null}
          color={entry.rotation && getStyleForRotation(entry.rotation)}
          anchorOrigin={{
            vertical: "top",
            horizontal: "left",
          }}
        >
          <AspectRatio
            ratio={1}
            sx={{
              flexBasis: "calc(60px - 12px)",
              borderRadius: "9px",
              minWidth: "48px",
              minHeight: "48px",
            }}
          >
            {image ? (
              <img
                src={image}
                alt="album art"
                style={{ minWidth: "48px", minHeight: "48px" }}
              />
            ) : (
              <CircularProgress />
            )}
          </AspectRatio>
        </Badge>
        <Stack
          direction="row"
          sx={{ flexGrow: 1, maxWidth: "calc(100% - 98px)" }}
          spacing={1}
        >
          <FlowsheetEntryField
            label="song"
            name={"track_title"}
            entry={entry}
            playing={playing}
            queue={queue}
            editable={editable}
          />
          <FlowsheetEntryField
            label="artist"
            name={"artist_name"}
            entry={entry}
            playing={playing}
            queue={queue}
            editable={editable}
          />
          <FlowsheetEntryField
            label="album"
            name={"album_title"}
            entry={entry}
            playing={playing}
            queue={queue}
            editable={editable}
          />
          <FlowsheetEntryField
            label="label"
            name={"record_label"}
            entry={entry}
            playing={playing}
            queue={queue}
            editable={editable}
          />
        </Stack>
      </Stack>
    </Sheet>
  );
}
