"use client";

import { flowsheetSlice } from "@/lib/features/flowsheet/frontend";
import { FlowsheetSongEntry } from "@/lib/features/flowsheet/types";
import { useAppDispatch } from "@/lib/hooks";
import { useFlowsheetActions, useShowControl } from "@/src/hooks/flowsheetHooks";
import { useFlowsheetMoveContext } from "@/src/components/experiences/modern/flowsheet/Entries/dragContext";
import { entryFieldTextColor } from "@/src/utilities/modern/entryFieldColors";
import {
  CheckRounded,
  CloseRounded,
  EditOutlined,
  KeyboardArrowDownRounded,
  KeyboardArrowUpRounded,
  PlayArrow,
} from "@mui/icons-material";
import {
  AspectRatio,
  Box,
  Button,
  IconButton,
  Input,
  Sheet,
  Stack,
  Tooltip,
  Typography,
} from "@mui/joy";
import { memo, useEffect, useState } from "react";
import RemoveButton from "../Components/RemoveButton";
import FlowsheetEntryField from "./FlowsheetEntryField";
import SongEntryControls from "./SongEntryControls";
import SongEntryStatusChips from "./SongEntryStatusChips";
import { usePlayNow } from "./usePlayNow";

type EditableName =
  | "track_title"
  | "artist_name"
  | "album_title"
  | "record_label";

const FIELDS: {
  name: EditableName;
  key: "song" | "artist" | "album" | "label";
  label: string;
  editLabel: string;
  level: "title-sm" | "body-sm";
}[] = [
  { name: "track_title", key: "song", label: "song", editLabel: "Title", level: "title-sm" },
  { name: "artist_name", key: "artist", label: "artist", editLabel: "Artist", level: "body-sm" },
  { name: "album_title", key: "album", label: "album", editLabel: "Album", level: "body-sm" },
  { name: "record_label", key: "label", label: "label", editLabel: "Label", level: "body-sm" },
];

// Below the `sm` breakpoint the entries table is hidden and each song renders
// as this "now playing"-style card: album art at left, values stacked in the
// middle, and a compact vertical control column at the right.
// Memoized (see SongEntry): Immer gives changed entries new references.
const MobileSongEntry = memo(function MobileSongEntry({
  playing,
  queue,
  entry,
  canMoveUp = false,
  canMoveDown = false,
}: {
  playing: boolean;
  queue: boolean;
  entry: FlowsheetSongEntry;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
}) {
  const { live, currentShow } = useShowControl();
  const { updateFlowsheet } = useFlowsheetActions();
  const { moveEntry } = useFlowsheetMoveContext();
  const dispatch = useAppDispatch();
  const playNow = usePlayNow(entry);

  const editable = queue || (live && entry.show_id == currentShow);
  const image = entry.artwork_url ?? "/img/cassette.png";

  const bgcolor = playing
    ? "primary.solidBg"
    : queue
      ? "success.softBg"
      : "background.surface";

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Record<EditableName, string>>({
    track_title: entry.track_title,
    artist_name: entry.artist_name,
    album_title: entry.album_title,
    record_label: entry.record_label,
  });

  // Keep the draft in sync with the entry whenever we're not editing.
  useEffect(() => {
    if (!editing) {
      setDraft({
        track_title: entry.track_title,
        artist_name: entry.artist_name,
        album_title: entry.album_title,
        record_label: entry.record_label,
      });
    }
  }, [
    entry.track_title,
    entry.artist_name,
    entry.album_title,
    entry.record_label,
    editing,
  ]);

  const saveAll = () => {
    if (queue) {
      FIELDS.forEach((f) =>
        dispatch(
          flowsheetSlice.actions.updateQueueEntry({
            entry_id: entry.id,
            field: f.name,
            value: draft[f.name],
          })
        )
      );
    } else {
      // One call carries all four fields.
      updateFlowsheet({ entry_id: entry.id, data: { ...draft } });
    }
    setEditing(false);
  };

  return (
    <Sheet
      variant="soft"
      sx={{
        borderRadius: "xl",
        p: 1.5,
        bgcolor,
        display: "flex",
        flexDirection: "column",
        gap: 1.25,
        border: playing ? "none" : "1px solid",
        borderColor: "background.level2",
        // A soft elevation so the card floats off the page like a media card.
        boxShadow: playing
          ? "0 10px 24px -8px rgba(0,0,0,0.5)"
          : "0 4px 12px -4px rgba(0,0,0,0.3)",
      }}
    >
      {/* Top: album art on the left, values stacked next to it. */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
      <Box sx={{ position: "relative", flexShrink: 0 }}>
        <AspectRatio ratio={1} sx={{ width: 68, borderRadius: "12px" }}>
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

      {/* Values (or, while editing, pre-filled inputs) stacked in the middle. */}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        {editing ? (
          <Stack gap={0.5}>
            {FIELDS.map((f) => (
              <Input
                key={f.name}
                size="sm"
                variant="outlined"
                value={draft[f.name]}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, [f.name]: e.target.value }))
                }
                startDecorator={
                  <Typography
                    level="body-xs"
                    textColor="text.tertiary"
                    sx={{ minWidth: 42 }}
                  >
                    {f.editLabel}
                  </Typography>
                }
              />
            ))}
          </Stack>
        ) : (
          <Stack sx={{ minWidth: 0 }}>
            <FlowsheetEntryField
              label="song"
              name="track_title"
              entry={entry}
              playing={playing}
              queue={queue}
              editable={false}
              level="title-sm"
              textColor={entryFieldTextColor("song", playing)}
            />
            {/* Artist and album share one line to lengthen the row. */}
            <Box sx={{ display: "flex", alignItems: "baseline", gap: 0.75, minWidth: 0 }}>
              <Box sx={{ flex: "0 1 auto", minWidth: 0 }}>
                <FlowsheetEntryField
                  label="artist"
                  name="artist_name"
                  entry={entry}
                  playing={playing}
                  queue={queue}
                  editable={false}
                  level="body-sm"
                  textColor={entryFieldTextColor("artist", playing)}
                />
              </Box>
              <Typography
                level="body-sm"
                textColor={playing ? "rgba(255,255,255,0.72)" : "text.tertiary"}
                sx={{ flexShrink: 0 }}
              >
                ·
              </Typography>
              <Box sx={{ flex: "0 1 auto", minWidth: 0 }}>
                <FlowsheetEntryField
                  label="album"
                  name="album_title"
                  entry={entry}
                  playing={playing}
                  queue={queue}
                  editable={false}
                  level="body-sm"
                  textColor={entryFieldTextColor("album", playing)}
                />
              </Box>
            </Box>
            <FlowsheetEntryField
              label="label"
              name="record_label"
              entry={entry}
              playing={playing}
              queue={queue}
              editable={false}
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
        )}
      </Box>
      </Box>

      {/* Bottom: the control tray as a centered horizontal bar. */}
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="center"
        gap={1.25}
        sx={{
          alignSelf: "center",
          "--IconButton-size": "32px",
          borderRadius: "xl",
          px: 1.5,
          py: 0.25,
          bgcolor: playing ? "rgba(255,255,255,0.12)" : "background.level1",
          color: playing ? "common.white" : "text.secondary",
        }}
      >
        {editing ? (
          <>
            <Tooltip title="Save" variant="outlined" size="sm">
              <IconButton
                size="sm"
                variant="plain"
                color="primary"
                aria-label="Save entry"
                onClick={saveAll}
              >
                <CheckRounded />
              </IconButton>
            </Tooltip>
            <Tooltip title="Cancel" variant="outlined" size="sm">
              <IconButton
                size="sm"
                variant="plain"
                color="neutral"
                aria-label="Cancel editing"
                onClick={() => setEditing(false)}
              >
                <CloseRounded />
              </IconButton>
            </Tooltip>
          </>
        ) : (
          <>
            {/* One-step reorder — the mobile stand-in for drag. */}
            {editable && (canMoveUp || canMoveDown) && (
              <>
                <Tooltip title="Move up" variant="outlined" size="sm">
                  <IconButton
                    size="sm"
                    variant="plain"
                    color="neutral"
                    aria-label="Move up"
                    disabled={!canMoveUp}
                    onClick={() => moveEntry(entry, "up")}
                  >
                    <KeyboardArrowUpRounded />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Move down" variant="outlined" size="sm">
                  <IconButton
                    size="sm"
                    variant="plain"
                    color="neutral"
                    aria-label="Move down"
                    disabled={!canMoveDown}
                    onClick={() => moveEntry(entry, "down")}
                  >
                    <KeyboardArrowDownRounded />
                  </IconButton>
                </Tooltip>
              </>
            )}
            <SongEntryControls
              entry={entry}
              queue={queue}
              editable={editable}
              showRemove={false}
            />
            {editable && (
              <Tooltip title="Edit fields" variant="outlined" size="sm">
                <IconButton
                  size="sm"
                  variant="plain"
                  color="neutral"
                  aria-label="Edit entry"
                  onClick={() => setEditing(true)}
                >
                  <EditOutlined />
                </IconButton>
              </Tooltip>
            )}
            {/* Delete last, at the end of the bar. */}
            {editable && <RemoveButton queue={queue} entry={entry} />}
          </>
        )}
      </Stack>
    </Sheet>
  );
});

export default MobileSongEntry;
