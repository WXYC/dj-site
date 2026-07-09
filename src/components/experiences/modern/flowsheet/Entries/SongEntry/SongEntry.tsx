"use client";

import { applicationSlice } from "@/lib/features/application/frontend";
import { useAddToFlowsheetMutation } from "@/lib/features/flowsheet/api";
import { flowsheetSlice } from "@/lib/features/flowsheet/frontend";
import {
  FlowsheetSongEntry,
  FlowsheetSubmissionParams,
} from "@/lib/features/flowsheet/types";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { useFlowsheet, useShowControl } from "@/src/hooks/flowsheetHooks";
import { getStyleForRotation } from "@/src/utilities/modern/rotationstyles";
import { entryFieldTextColor } from "@/src/utilities/modern/entryFieldColors";
import {
  InfoOutlined,
  LinkRounded,
  LinkOff,
  PhoneDisabled,
  PhoneEnabled,
  PlayArrow,
} from "@mui/icons-material";
import {
  AspectRatio,
  Checkbox,
  Chip,
  IconButton,
  Stack,
  Tooltip,
} from "@mui/joy";
import { useDragControls } from "motion/react";
import { useState } from "react";
import DragButton from "../Components/DragButton";
import RemoveButton from "../Components/RemoveButton";
import DraggableEntryWrapper from "../DraggableEntryWrapper";
import FlowsheetEntryField from "./FlowsheetEntryField";
import { toast } from "sonner";

// Caption-scale status pills, matching the catalog table's chip language.
const STATUS_CHIP_SX = {
  fontSize: "0.65rem",
  fontWeight: 500,
  "--Chip-minHeight": "16px",
  "--Chip-paddingInline": "6px",
} as const;

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
  const [addToFlowsheet, addToFlowsheetResult] = useAddToFlowsheetMutation();
  const queueItems = useAppSelector((state) => state.flowsheet.queue);

  const controls = useDragControls();

  const [canClose, setCanClose] = useState(false);

  const editable = queue || (live && entry.show_id == currentShow);

  const { updateFlowsheet } = useFlowsheet();

  const image = entry.artwork_url ?? "/img/cassette.png";

  const dispatch = useAppDispatch();

  const handleMouseEnter = () => {
    if (queue && live) {
      setCanClose(true);
    }
  };

  const handleMouseLeave = () => {
    setCanClose(false);
  };

  return (
    <DraggableEntryWrapper
      controls={controls}
      entryRef={entry}
      variant={queue ? "soft" : playing ? "solid" : "plain"}
      color={queue ? "success" : playing ? "primary" : "neutral"}
      style={{
        height: "60px",
        borderRadius: "md",
        marginBottom: playing && autoplay ? "0.25rem" : "initial",
        opacity: queue ? 0.85 : 1,
      }}
    >
      <td
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <Stack direction="row" sx={{ position: "relative" }}>
          {editable && <DragButton controls={controls} />}
          <AspectRatio
            ratio={1}
            sx={{
              flexBasis: "calc(60px - 12px)",
              borderRadius: "9px",
              minWidth: "48px",
              minHeight: "48px",
            }}
          >
            <img
              src={image}
              alt="album art"
              style={{ minWidth: "48px", minHeight: "48px" }}
            />
          </AspectRatio>
          {canClose && queue && (
            <Tooltip
              title="Play this song now (add to flowsheet)"
              placement="right"
              variant="outlined"
              size="sm"
            >
              <IconButton
                size="sm"
                variant="solid"
                color="primary"
                sx={{
                  position: "absolute",
                  left: editable ? "10px" : "0px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  zIndex: 10,
                }}
                onClick={() => {
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
                    .then(() => {
                      dispatch(flowsheetSlice.actions.removeFromQueue(entry.id));
                    })
                    .catch((error) => {
                      toast.error(`Failed to add to flowsheet: ${error}`);
                    });
                }}
              >
                <PlayArrow />
              </IconButton>
            </Tooltip>
          )}
        </Stack>
      </td>
      <td onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
        <FlowsheetEntryField
          label="song"
          name={"track_title"}
          entry={entry}
          playing={playing}
          queue={queue}
          editable={editable}
          level="title-sm"
          textColor={entryFieldTextColor("song", playing)}
        />
      </td>
      <td onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
        <FlowsheetEntryField
          label="artist"
          name={"artist_name"}
          entry={entry}
          playing={playing}
          queue={queue}
          editable={editable}
          level="body-sm"
          textColor={entryFieldTextColor("artist", playing)}
        />
      </td>
      <td onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
        <FlowsheetEntryField
          label="album"
          name={"album_title"}
          entry={entry}
          playing={playing}
          queue={queue}
          editable={editable}
          level="body-sm"
          textColor={entryFieldTextColor("album", playing)}
        />
      </td>
      <td onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
        <FlowsheetEntryField
          label="label"
          name={"record_label"}
          entry={entry}
          playing={playing}
          queue={queue}
          editable={editable}
          level="body-sm"
          textColor={entryFieldTextColor("label", playing)}
        />
      </td>
      <td
        style={{ position: "relative" }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <Stack direction="row" gap={0.75} alignItems="center" flexWrap="wrap">
          {entry.rotation && (
            <Chip
              size="sm"
              variant="solid"
              color={getStyleForRotation(entry.rotation)}
              aria-label={`Rotation ${entry.rotation}`}
              sx={STATUS_CHIP_SX}
            >
              {entry.rotation}
            </Chip>
          )}
          {entry.on_streaming === false && (
            <Chip
              variant="soft"
              size="sm"
              sx={{
                ...STATUS_CHIP_SX,
                backgroundColor: "#7B2D8E",
                color: "#fff",
                letterSpacing: "0.5px",
              }}
            >
              EXCLUSIVE
            </Chip>
          )}
          {entry.request_flag && !editable && (
            <Chip size="sm" variant="soft" color="warning" sx={STATUS_CHIP_SX}>
              REQ
            </Chip>
          )}
          {entry.segue && !editable && (
            <Chip size="sm" variant="soft" color="neutral" sx={STATUS_CHIP_SX}>
              SEGUE
            </Chip>
          )}
        </Stack>
        <Stack
          direction="row"
          justifyContent={"flex-end"}
          alignItems={"center"}
          spacing={0.5}
          className="row-actions"
          sx={{
            position: "absolute",
            right: 8,
            top: "50%",
            transform: "translateY(-50%)",
            borderRadius: "sm",
            pl: 3,
            pr: 0.5,
          }}
        >
          {editable && (
          <>
          <Tooltip
            variant="outlined"
            size="sm"
            title="Does this track segue from the previous?"
          >
            <Checkbox
              size="sm"
              variant="soft"
              color={entry.segue ? "primary" : "neutral"}
              className={entry.segue ? "row-actions-persist" : undefined}
              uncheckedIcon={<LinkOff />}
              checkedIcon={<LinkRounded />}
              slotProps={{
                input: { "aria-label": "Segue from previous track" },
              }}
              sx={{
                opacity: entry.segue ? 1 : 0.3,
                "& .MuiCheckbox-checkbox": {
                  background: "transparent",
                },
              }}
              checked={entry.segue}
              onChange={(e) => {
                if (queue) {
                  // Update queue entry in Redux state
                  dispatch(flowsheetSlice.actions.updateQueueEntry({
                    entry_id: entry.id,
                    field: 'segue',
                    value: e.target.checked,
                  }));
                } else {
                  // Update flowsheet entry via API
                  updateFlowsheet({
                    entry_id: entry.id,
                    data: {
                      segue: e.target.checked,
                    },
                  });
                }
              }}
            />
          </Tooltip>
          <Tooltip
            variant="outlined"
            size="sm"
            title="Was this song a request?"
          >
            <Checkbox
              size="sm"
              variant="soft"
              color={entry.request_flag ? "warning" : "neutral"}
              className={entry.request_flag ? "row-actions-persist" : undefined}
              uncheckedIcon={<PhoneDisabled />}
              checkedIcon={<PhoneEnabled />}
              slotProps={{
                input: { "aria-label": "Requested track" },
              }}
              sx={{
                opacity: entry.request_flag ? 1 : 0.3,
                "& .MuiCheckbox-checkbox": {
                  background: "transparent",
                },
              }}
              checked={entry.request_flag}
              onChange={(e) => {
                if (queue) {
                  // Update queue entry in Redux state
                  dispatch(flowsheetSlice.actions.updateQueueEntry({
                    entry_id: entry.id,
                    field: 'request_flag',
                    value: e.target.checked,
                  }));
                } else {
                  // Update flowsheet entry via API
                  updateFlowsheet({
                    entry_id: entry.id,
                    data: {
                      request_flag: e.target.checked,
                    },
                  });
                }
              }}
            />
          </Tooltip>
          </>
          )}
          <IconButton
            color="neutral"
            variant="plain"
            size="sm"
            disabled={!entry?.album_id || entry.album_id < 0}
            onClick={() => dispatch(applicationSlice.actions.openPanel({ type: "album-detail", albumId: entry.album_id! }))}
          >
            <InfoOutlined />
          </IconButton>
          {editable && <RemoveButton queue={queue} entry={entry} />}
        </Stack>
      </td>
    </DraggableEntryWrapper>
  );
}
