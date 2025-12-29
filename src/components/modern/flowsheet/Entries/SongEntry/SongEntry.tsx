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
  ArtTrack,
  InfoOutlined,
  KeyboardArrowDown,
  MusicNote,
  Person2,
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
import { toast } from "sonner";

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
        borderRadius: "8px",
        marginBottom: playing && autoplay ? "0.25rem" : "initial",
        opacity: queue ? 0.85 : 1,
      }}
    >
      {/* Album Art Section */}
      <Box
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          width: "60px",
          position: "relative",
        }}
      >
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
              width: "48px",
              borderRadius: "9px",
              minWidth: "48px",
              minHeight: "48px"
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
                  rotation_id: entry.rotation_id,
                  album_id: entry.album_id,
                  play_freq: entry.rotation,
                } as FlowsheetSubmissionParams)
                  .then(() => {
                    dispatch(flowsheetSlice.actions.removeFromQueue(entry.id));
                  })
                  .catch((error) => {
                    toast.error("Failed to add to flowsheet:", error);
                  });
              }}
            >
              <PlayArrow />
            </IconButton>
          </Tooltip>
        )}
      </Box>

      <Box
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        sx={{ flex: 1, minWidth: 0, px: 1 }}
      >
        <FlowsheetEntryField
          label="song"
          name={"track_title"}
          entry={entry}
          playing={playing}
          queue={queue}
          editable={editable}
          startDecorator={<MusicNote />}
        />
      </Box>

      <Box
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        sx={{ flex: 1, minWidth: 0, px: 1 }}
      >
        <FlowsheetEntryField
          label="artist"
          name={"artist_name"}
          entry={entry}
          playing={playing}
          queue={queue}
          editable={editable}
          startDecorator={<Person2 />}
        />
      </Box>

      <Box
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        sx={{ flex: 1, minWidth: 0, px: 1 }}
      >
        <FlowsheetEntryField
          label="album"
          name={"album_title"}
          entry={entry}
          playing={playing}
          queue={queue}
          editable={editable}
          startDecorator={<Album />}
        />
      </Box>

      <Box
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        sx={{ flex: 1, minWidth: 0, px: 1 }}
      >
        <FlowsheetEntryField
          label="label"
          name={"record_label"}
          entry={entry}
          playing={playing}
          queue={queue}
          editable={editable}
          startDecorator={<ArtTrack />}
        />
      </Box>

      <Box
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          flexShrink: 0,
          gap: 0.5,
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
        <LinkIconButton
          color="neutral"
          variant="plain"
          size="sm"
          href={`/dashboard/album/${entry.album_id}`}
          disabled={!entry?.album_id || entry.album_id < 0}
        >
          <InfoOutlined />
        </LinkIconButton>
        {editable && (
          <>
            <RemoveButton queue={queue} entry={entry} />
            <DragButton controls={controls} />
          </>
        )}
      </Box>
    </DraggableEntryWrapper>
  );
}
