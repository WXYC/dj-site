"use client";

import { useAddToFlowsheetMutation } from "@/lib/features/flowsheet/api";
import { flowsheetSlice } from "@/lib/features/flowsheet/frontend";
import {
  FlowsheetSongEntry,
  FlowsheetSubmissionParams,
} from "@/lib/features/flowsheet/types";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { LinkIconButton } from "@/src/components/General/LinkButton";
import { useAlbumImages } from "@/src/hooks/applicationHooks";
import { useFlowsheet, useShowControl } from "@/src/hooks/flowsheetHooks";
import { getStyleForRotation } from "@/src/utilities/modern/rotationstyles";
import {
  Album,
  InfoOutlined,
  KeyboardArrowDown,
  MusicNote,
  PhoneDisabled,
  PhoneEnabled,
  PlayArrow,
} from "@mui/icons-material";
import {
  AspectRatio,
  Badge,
  Box,
  Checkbox,
  CircularProgress,
  IconButton,
  Stack,
  Tooltip,
} from "@mui/joy";
import { useDragControls } from "motion/react";
import { useEffect, useState } from "react";
import DragButton from "../Components/DragButton";
import RemoveButton from "../Components/RemoveButton";
import DraggableEntryWrapper from "../DraggableEntryWrapper";
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
  const [addToFlowsheet, addToFlowsheetResult] = useAddToFlowsheetMutation();
  const queueItems = useAppSelector((state) => state.flowsheet.queue);

  const controls = useDragControls();

  const [canClose, setCanClose] = useState(false);

  const editable = queue || (live && entry.show_id == currentShow);

  const { updateFlowsheet } = useFlowsheet();

  const {
    url: image,
    loading: imageLoading,
    setAlbum,
    setArtist,
  } = useAlbumImages();

  useEffect(() => {
    if (!entry.album_title || !entry.artist_name) return;

    setAlbum(entry.album_title);
    setArtist(entry.artist_name);
  }, [entry.album_title, entry.artist_name, setAlbum, setArtist]);

  const dispatch = useAppDispatch();

  return (
    <DraggableEntryWrapper
      controls={controls}
      entryRef={entry}
      variant="plain"
      color={playing ? "primary" : "neutral"}
      style={{
        height: "60px",
        borderRadius: "md",
        marginBottom: playing && autoplay ? "0.25rem" : "initial",
      }}
    >
      <td>
        <Stack direction="row">
          {editable && <DragButton controls={controls} />}
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
              {image && !imageLoading ? (
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
        </Stack>
      </td>
      <td colSpan={2}>
        <FlowsheetEntryField
          label="album"
          name={"album_title"}
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
          level="body-xs"
        />
      </td>
      <td colSpan={2}>
        <FlowsheetEntryField
          label="song"
          name={"track_title"}
          entry={entry}
          playing={playing}
          queue={queue}
          editable={editable}
          startDecorator={<MusicNote />}
        />
      </td>
      <td colSpan={2}>
        <FlowsheetEntryField
          label="label"
          name={"record_label"}
          entry={entry}
          playing={playing}
          queue={queue}
          editable={editable}
          startDecorator={<Album />}
        />
      </td>
      <td>
        <Stack
          direction="row"
          justifyContent={"flex-end"}
          alignItems={"center"}
          spacing={0.5}
          sx={{
            position: "relative",
          }}
        >
          {canClose && queue && (
            <IconButton
              size="sm"
              variant="solid"
              color="primary"
              sx={{
                position: "absolute",
                left: 16,
              }}
              onClick={() => {
                addToFlowsheet({
                  track_title: entry.track_title,
                  artist_name: entry.artist_name,
                  album_title: entry.album_title,
                  record_label: entry.record_label,
                  request_flag: entry.request_flag,
                  rotation_id: entry.rotation_id,
                  album_id: entry.album_id,
                  play_freq: entry.rotation,
                } as FlowsheetSubmissionParams).then(() => {
                  dispatch(flowsheetSlice.actions.removeFromQueue(entry.id));
                });
              }}
            >
              <PlayArrow />
            </IconButton>
          )}
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "40px",
              height: "40px",
            }}
          >
            <Tooltip
              variant="outlined"
              size="sm"
              title="Was this song a request?"
            >
              <Checkbox
                size="sm"
                variant="soft"
                color={entry.request_flag ? "warning" : "neutral"}
                uncheckedIcon={<PhoneDisabled />}
                checkedIcon={<PhoneEnabled />}
                disabled={!editable}
                sx={{
                  opacity: entry.request_flag ? 1 : 0.3,
                  "& .MuiCheckbox-checkbox": {
                    background: "transparent",
                  },
                }}
                checked={entry.request_flag}
                onChange={(e) =>
                  updateFlowsheet({
                    entry_id: entry.id,
                    data: {
                      request_flag: e.target.checked,
                    },
                  })
                }
              />
            </Tooltip>
          </Box>
          <LinkIconButton
            color="neutral"
            variant="plain"
            size="sm"
            href={`/dashboard/album/${entry.album_id}`}
            disabled={!entry?.album_id || entry.album_id < 0}
          >
            <InfoOutlined />
          </LinkIconButton>
          {playing && queueItems.length > 0 && (
            <IconButton
              color="neutral"
              variant="plain"
              size="sm"
              onClick={() => {
                console.log("play off top");
              }}
            >
              <KeyboardArrowDown />
            </IconButton>
          )}
          {editable && (
            <>
              <RemoveButton queue={queue} entry={entry} />
              <DragButton controls={controls} />
            </>
          )}
        </Stack>
      </td>
    </DraggableEntryWrapper>
  );
}
