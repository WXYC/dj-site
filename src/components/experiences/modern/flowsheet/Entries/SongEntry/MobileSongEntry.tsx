"use client";

import { flowsheetSlice } from "@/lib/features/flowsheet/frontend";
import { useAddToFlowsheetMutation } from "@/lib/features/flowsheet/api";
import {
  FlowsheetSongEntry,
  FlowsheetSubmissionParams,
} from "@/lib/features/flowsheet/types";
import { useAppDispatch } from "@/lib/hooks";
import { useFlowsheet, useShowControl } from "@/src/hooks/flowsheetHooks";
import { entryFieldTextColor } from "@/src/utilities/modern/entryFieldColors";
import { CheckRounded, CloseRounded, EditOutlined, PlayArrow } from "@mui/icons-material";
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
import { useEffect, useState } from "react";
import { toast } from "sonner";
import FlowsheetEntryField from "./FlowsheetEntryField";
import SongEntryControls from "./SongEntryControls";
import SongEntryStatusChips from "./SongEntryStatusChips";

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
  const { updateFlowsheet } = useFlowsheet();
  const dispatch = useAppDispatch();

  const editable = queue || (live && entry.show_id == currentShow);
  const image = entry.artwork_url ?? "/img/cassette.png";

  const bgcolor = playing
    ? "primary.solidBg"
    : queue
      ? "success.softBg"
      : "background.level1";

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
        p: 1.25,
        bgcolor,
        display: "flex",
        alignItems: "center",
        gap: 1.25,
        boxShadow: playing ? "0 6px 12px -4px rgba(0,0,0,0.35)" : "none",
      }}
    >
      {/* Album art on the left, vertically centered. */}
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
            {FIELDS.map((f) => (
              <FlowsheetEntryField
                key={f.name}
                label={f.label}
                name={f.name}
                entry={entry}
                playing={playing}
                queue={queue}
                editable={false}
                level={f.level}
                textColor={entryFieldTextColor(f.key, playing)}
              />
            ))}
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

      {/* Compact vertical control column at the right. */}
      <Stack
        alignItems="center"
        gap={0.25}
        sx={{ flexShrink: 0, "--IconButton-size": "30px" }}
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
            <SongEntryControls entry={entry} queue={queue} editable={editable} />
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
          </>
        )}
      </Stack>
    </Sheet>
  );
}
