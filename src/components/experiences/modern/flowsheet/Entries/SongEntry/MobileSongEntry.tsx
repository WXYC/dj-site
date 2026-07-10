"use client";

import { flowsheetSlice } from "@/lib/features/flowsheet/frontend";
import { useAddToFlowsheetMutation } from "@/lib/features/flowsheet/api";
import {
  FlowsheetSongEntry,
  FlowsheetSubmissionParams,
} from "@/lib/features/flowsheet/types";
import { useAppDispatch } from "@/lib/hooks";
import { useShowControl } from "@/src/hooks/flowsheetHooks";
import { entryFieldTextColor } from "@/src/utilities/modern/entryFieldColors";
import { PlayArrow } from "@mui/icons-material";
import { AspectRatio, Box, Button, Sheet, Stack } from "@mui/joy";
import { toast } from "sonner";
import FlowsheetEntryField from "./FlowsheetEntryField";
import SongEntryControls from "./SongEntryControls";
import SongEntryStatusChips from "./SongEntryStatusChips";

// Below the `sm` breakpoint the desktop entries table is hidden and each song
// renders as this stacked card instead: album art on top, the fields stacked
// (each with its own edit pencil), status chips, then the utility controls
// along the bottom.
export default function MobileSongEntry({
  playing,
  queue,
  entry,
}: {
  playing: boolean;
  queue: boolean;
  entry: FlowsheetSongEntry;
}) {
  const { live, currentShow } = useShowControl();
  const [addToFlowsheet] = useAddToFlowsheetMutation();
  const dispatch = useAppDispatch();

  const editable = queue || (live && entry.show_id == currentShow);
  const image = entry.artwork_url ?? "/img/cassette.png";

  const bgcolor = playing
    ? "primary.solidBg"
    : queue
      ? "success.softBg"
      : "background.level1";

  const playNow = () => {
    addToFlowsheet({
      track_title: entry.track_title,
      artist_name: entry.artist_name,
      album_title: entry.album_title,
      record_label: entry.record_label,
      request_flag: entry.request_flag,
      segue: entry.segue,
      rotation_id: entry.rotation_id,
      album_id: entry.album_id,
      rotation_bin: entry.rotation,
    } as FlowsheetSubmissionParams)
      .then(() => dispatch(flowsheetSlice.actions.removeFromQueue(entry.id)))
      .catch((error) => toast.error(`Failed to add to flowsheet: ${error}`));
  };

  const fieldProps = {
    entry,
    playing,
    queue,
    editable,
    revealEditOn: "always" as const,
    editLayout: "inline" as const,
  };

  return (
    <Sheet
      variant="soft"
      sx={{
        borderRadius: "md",
        p: 1.25,
        bgcolor,
        display: "flex",
        flexDirection: "column",
        gap: 1,
        boxShadow: playing ? "0 6px 12px -4px rgba(0,0,0,0.35)" : "none",
      }}
    >
      {/* Album art on the left, values stacked next to it. */}
      <Box sx={{ display: "flex", gap: 1.25, alignItems: "flex-start" }}>
        <Box sx={{ position: "relative", flexShrink: 0 }}>
          <AspectRatio ratio={1} sx={{ width: 64, borderRadius: "9px" }}>
            <img src={image} alt="album art" />
          </AspectRatio>
          {queue && live && (
            <Button
              size="sm"
              variant="solid"
              color="primary"
              startDecorator={<PlayArrow />}
              onClick={playNow}
              sx={{
                position: "absolute",
                inset: 0,
                m: "auto",
                height: "fit-content",
                width: "fit-content",
              }}
            >
              Play
            </Button>
          )}
        </Box>

        <Stack sx={{ flex: 1, minWidth: 0 }}>
          <FlowsheetEntryField
            {...fieldProps}
            label="song"
            name="track_title"
            level="title-sm"
            textColor={entryFieldTextColor("song", playing)}
          />
          <FlowsheetEntryField
            {...fieldProps}
            label="artist"
            name="artist_name"
            level="body-sm"
            textColor={entryFieldTextColor("artist", playing)}
          />
          <FlowsheetEntryField
            {...fieldProps}
            label="album"
            name="album_title"
            level="body-sm"
            textColor={entryFieldTextColor("album", playing)}
          />
          <FlowsheetEntryField
            {...fieldProps}
            label="label"
            name="record_label"
            level="body-sm"
            textColor={entryFieldTextColor("label", playing)}
          />
          <Stack
            direction="row"
            gap={0.75}
            alignItems="center"
            flexWrap="wrap"
            sx={{ mt: 0.5 }}
          >
            <SongEntryStatusChips entry={entry} editable={editable} />
          </Stack>
        </Stack>
      </Box>

      {/* Utility controls along the bottom. */}
      <Stack
        direction="row"
        gap={0.5}
        alignItems="center"
        justifyContent="flex-end"
      >
        <SongEntryControls entry={entry} queue={queue} editable={editable} />
      </Stack>
    </Sheet>
  );
}
