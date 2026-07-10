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
import { AspectRatio, Box, Button, Divider, Sheet, Stack } from "@mui/joy";
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

  return (
    <Sheet
      variant="soft"
      sx={{
        borderRadius: "md",
        p: 1.5,
        bgcolor,
        display: "flex",
        flexDirection: "column",
        gap: 1,
        boxShadow: playing ? "0 6px 12px -4px rgba(0,0,0,0.35)" : "none",
      }}
    >
      {/* Album art on top, with the queue "play now" affordance overlaid. */}
      <Box sx={{ position: "relative", alignSelf: "flex-start" }}>
        <AspectRatio ratio={1} sx={{ width: 72, borderRadius: "9px" }}>
          <img src={image} alt="album art" />
        </AspectRatio>
        {queue && live && (
          <Button
            size="sm"
            variant="solid"
            color="primary"
            startDecorator={<PlayArrow />}
            onClick={playNow}
            sx={{ position: "absolute", inset: 0, m: "auto", height: "fit-content", width: "fit-content" }}
          >
            Play
          </Button>
        )}
      </Box>

      {/* Stacked fields, each carrying its own edit pencil at the right. */}
      <Stack sx={{ minWidth: 0 }}>
        <FlowsheetEntryField
          label="song"
          name="track_title"
          entry={entry}
          playing={playing}
          queue={queue}
          editable={editable}
          level="title-sm"
          textColor={entryFieldTextColor("song", playing)}
          revealEditOn="always"
        />
        <FlowsheetEntryField
          label="artist"
          name="artist_name"
          entry={entry}
          playing={playing}
          queue={queue}
          editable={editable}
          level="body-sm"
          textColor={entryFieldTextColor("artist", playing)}
          revealEditOn="always"
        />
        <FlowsheetEntryField
          label="album"
          name="album_title"
          entry={entry}
          playing={playing}
          queue={queue}
          editable={editable}
          level="body-sm"
          textColor={entryFieldTextColor("album", playing)}
          revealEditOn="always"
        />
        <FlowsheetEntryField
          label="label"
          name="record_label"
          entry={entry}
          playing={playing}
          queue={queue}
          editable={editable}
          level="body-sm"
          textColor={entryFieldTextColor("label", playing)}
          revealEditOn="always"
        />
      </Stack>

      <Stack direction="row" gap={0.75} alignItems="center" flexWrap="wrap">
        <SongEntryStatusChips entry={entry} editable={editable} />
      </Stack>

      <Divider />

      {/* Utility controls along the bottom. */}
      <Stack direction="row" gap={0.5} alignItems="center" justifyContent="flex-end">
        <SongEntryControls entry={entry} queue={queue} editable={editable} />
      </Stack>
    </Sheet>
  );
}
