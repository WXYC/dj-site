"use client";

import { useAddToFlowsheetMutation } from "@/lib/features/flowsheet/api";
import { flowsheetSlice } from "@/lib/features/flowsheet/frontend";
import {
  FlowsheetSongEntry,
  FlowsheetSubmissionParams,
} from "@/lib/features/flowsheet/types";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { LinkIconButton } from "@/src/components/General/LinkButton";
import { useShowControl } from "@/src/hooks/flowsheetHooks";
import { getStyleForRotation } from "@/src/utilities/modern/rotationstyles";
import {
  DragIndicator,
  InfoOutlined,
  KeyboardArrowDown,
  PhoneDisabled,
  PhoneEnabled,
  PlayArrow,
} from "@mui/icons-material";
import {
  AspectRatio,
  Badge,
  Checkbox,
  CircularProgress,
  IconButton,
  Sheet,
  Stack,
  Tooltip,
} from "@mui/joy";
import { useState } from "react";
import RemoveButton from "../Components/RemoveButton";
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

  const [canClose, setCanClose] = useState(false);

  const editable = queue || entry.show_id == currentShow;

  const [image, setImage] = useState<string>("/img/cassette.png");

  const dispatch = useAppDispatch();

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
        {canClose && queue && (
          <IconButton
            size="sm"
            variant="solid"
            color="primary"
            sx={{
              position: "absolute",
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
        <Tooltip variant="outlined" size="sm" title="Was this song a request?">
          <Checkbox
            size="sm"
            variant="soft"
            color={entry.request_flag ? "warning" : "neutral"}
            uncheckedIcon={<PhoneDisabled />}
            checkedIcon={<PhoneEnabled />}
            disabled={!(editable && live)}
            sx={{
              opacity: entry.request_flag ? 1 : 0.3,
              "& .MuiCheckbox-checkbox": {
                background: "transparent",
              },
            }}
            checked={entry.request_flag}
            onChange={(e) => {}}
          />
        </Tooltip>
        {entry.album_id && entry.album_id >= 0 && (
          <LinkIconButton
            color="neutral"
            variant="plain"
            size="sm"
            href={`/dashboard/album/${entry.album_id}`}
          >
            <InfoOutlined />
          </LinkIconButton>
        )}
        {playing && queueItems.length > 0 ? (
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
        ) : (
          editable &&
          live && (
            <IconButton
              color="neutral"
              variant="plain"
              size="sm"
              sx={{
                cursor: "grab",
                "&:hover": {
                  background: "none",
                },
              }}
              onMouseDown={(e) => {
                /*queue
                  ? setQueuePlaceholderIndex(props.index)
                  : setEntryPlaceholderIndex(props.index);
                let rect = entryClientRectRef.current.getBoundingClientRect();
                let button = e.target.getBoundingClientRect();
                setEntryClientRect({
                  x: rect.x,
                  y: rect.y,
                  width: rect.width,
                  height: rect.height,
                  offsetX: button.x - rect.x + 5,
                  offsetY: button.y - rect.y + 5,
                });*/
              }}
            >
              <DragIndicator />
            </IconButton>
          )
        )}
        <RemoveButton
          canClose={canClose}
          playing={playing}
          queue={queue}
          entry={entry}
        />
      </Stack>
    </Sheet>
  );
}
