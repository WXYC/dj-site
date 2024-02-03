"use client";

import {
    EntryRectProps,
    FlowSheetEntry,
    Rotation,
    flowSheetSlice, getArtwork, getAutoplay,
    getCurrentlyPlayingSongLength,
    getCurrentlyPlayingSongRemaining,
    getQueue,
    getRotation, isLive, useSelector
} from "@/lib/redux";
import ClearIcon from "@mui/icons-material/Clear";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import HeadphonesIcon from "@mui/icons-material/Headphones";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import LogoutIcon from "@mui/icons-material/Logout";
import MicIcon from "@mui/icons-material/Mic";
import PhoneDisabledIcon from "@mui/icons-material/PhoneDisabled";
import PhoneEnabledIcon from "@mui/icons-material/PhoneEnabled";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import TimerIcon from "@mui/icons-material/Timer";
import {
    AspectRatio,
    Badge,
    Button,
    Checkbox,
    CircularProgress,
    IconButton,
    LinearProgress,
    Sheet,
    Stack,
    Tooltip,
    Typography
} from "@mui/joy";
import { ClickAwayListener } from "@mui/material";
import { useCallback, useEffect, useRef, useState } from "react";
import { useDispatch } from "react-redux";
import { ROTATION_COLORS } from "./RotationAvatar";

function timeout(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface SongBoxProps extends FlowSheetEntry {
  index?: number;
  current?: boolean;
  type:
    | "entry"
    | "queue"
    | "placeholder"
    | "joined"
    | "left"
    | "breakpoint"
    | "talkset"
    | "error";
  editable?: boolean;
  rotation?: Rotation;
}

interface FlowsheetEntryFieldProps {
  label: string;
  value: string;
  current: boolean;
  id: number;
  queue: boolean;
    editable?: boolean;
}

/**
 * Represents a Flowsheet Entry component. Contains self-delete and play functionality.
 * @component
 * @category Flowsheet
 * @param {SongBoxProps} entry - The entry to be displayed.
 *
 * @returns {JSX.Element} - A Flowsheet Entry component.
 */
const SongBox = (entry: SongBoxProps): JSX.Element => {
  const dispatch = useDispatch();

  const queue = useSelector(getQueue);
  const updateQueueEntry = (id: number, field: string, value: string) =>
    dispatch(flowSheetSlice.actions.updateQueueEntry({ id, field, value }));
  const removeFromQueue = (id: number) =>
    dispatch(flowSheetSlice.actions.removeFromQueue(id));
  const removeFromEntries = (id: number) =>
    dispatch(flowSheetSlice.actions.removeFromEntries(id));
  const setQueuePlaceholderIndex = (index: number) =>
    dispatch(flowSheetSlice.actions.setQueuePlaceholderIndex(index));
  const setEntryPlaceholderIndex = (index: number) =>
    dispatch(flowSheetSlice.actions.setEntryPlaceholderIndex(index));
  const setEntryClientRect = (rect: EntryRectProps) =>
    dispatch(flowSheetSlice.actions.setEntryClientRect(rect));
  const addToEntries = (entry: FlowSheetEntry) =>
    dispatch(flowSheetSlice.actions.addToEntries(entry));
  const updateEntry = (id: number, field: string, value: string) =>
    dispatch(flowSheetSlice.actions.updateEntry({ id, field, value }));
  const autoPlay = useSelector(getAutoplay);
  const currentlyPlayingSongLength = useSelector(getCurrentlyPlayingSongLength);
  const currentTimeStamp = useSelector(getCurrentlyPlayingSongRemaining);
  const playOffTop = () => dispatch(flowSheetSlice.actions.playOffTop());

  const [image, setImage] = useState<string | null>(null);

  const entryClientRectRef = useRef<HTMLDivElement>(null);

  const [canClose, setCanClose] = useState(false);
  const live = useSelector(isLive);

  const rotation = useSelector(getRotation);
  const play_freq =
    rotation?.find((item) => item.level == entry.rotation)?.level ?? null;

  const getImage = useCallback(
    async (default_return = "") => {
      if (
        entry.song?.album == undefined ||
        entry.song?.album.artist == undefined
      )
        return default_return;

      await timeout(Math.random() * 800);

      let storedArtwork = sessionStorage.getItem(
        `img-${entry.song?.album?.title}-${entry.song?.album.artist.name}`
      );
      if (storedArtwork) return storedArtwork;
      try {
        let retrievedArtwork = await getArtwork(entry.song?.album.title, entry.song?.album.artist.name);
        if (retrievedArtwork == null) retrievedArtwork = default_return;
        // THE CONVENTION IS ALBUM THEN ARTIST IN THIS APP
        sessionStorage.setItem(
          `img-${entry.song?.album.title}-${entry.song?.album.artist.name}`,
          retrievedArtwork
        );
        return retrievedArtwork;
      } catch (e) {
        sessionStorage.setItem(
          `img-${entry.song?.album.title}-${entry.song?.album.artist.name}`,
          default_return
        );
        return default_return;
      }
    },
    [entry.song?.album, entry.song?.album?.artist]
  );

  useEffect(() => {
    getImage("apple-touch-icon.png").then((image) => {
      setImage(image);
    });
  }, [getImage]);

  const FlowsheetEntryField = (props: FlowsheetEntryFieldProps) => {
    const dispatch = useDispatch();

    const live = useSelector(isLive);
    const updateQueueEntry = (id: number, field: string, value: string) =>
      dispatch(flowSheetSlice.actions.updateQueueEntry({ id, field, value }));
    const updateEntry = (id: number, field: string, value: string) =>
      dispatch(flowSheetSlice.actions.updateEntry({ id, field, value }));

    const [editing, setEditing] = useState(false);
    const [value, setValue] = useState(props.value ?? "");

    const saveAndClose = (e: any) => {
      e.preventDefault();
      setEditing(false);
      let label = props.label == "song" ? "title" : props.label; // Hack to handle stylistic choice of 'song' over 'title'
      if (props.queue) {
        updateQueueEntry(props.id, label, value);
      } else {
        updateEntry(props.id, label, value);
      }
    };

    return (
      <Stack direction="column" sx={{ width: "calc(25%)" }}>
        <Typography
          level="body-sm"
          sx={{ mb: -1 }}
          textColor={props.current ? "primary.300" : "unset"}
        >
          {props.label.toUpperCase()}
        </Typography>
        {editing ? (
          <ClickAwayListener onClickAway={saveAndClose}>
            <form onSubmit={saveAndClose}>
              <Typography
                textColor={props.current ? "primary.lightChannel" : "unset"}
                sx={{
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  borderBottom: "1px solid",
                }}
              >
                <input
                  type="text"
                  style={{
                    color: "inherit",
                    fontFamily: "inherit",
                    fontSize: "inherit",
                    fontWeight: "inherit",
                    background: "transparent",
                    width: "100%",
                    border: "none",
                    outline: "none",
                    padding: "0",
                    margin: "0",
                  }}
                  defaultValue={props.value}
                  onChange={(e) => {
                    setValue(e.target.value);
                  }}
                  value={value}
                />
              </Typography>
            </form>
          </ClickAwayListener>
        ) : (
          <Typography
            textColor={props.current ? "primary.lightChannel" : "unset"}
            sx={{
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              cursor: "text",
              minWidth: "10px",
            }}
            onDoubleClick={() => setEditing((props.editable ?? false) && live)}
          >
            {props.value}&nbsp;
          </Typography>
        )}
      </Stack>
    );
  };

  switch (entry.type) {
    case "placeholder":
      return (
        <Sheet
          color={entry.current ? "primary" : "neutral"}
          variant="outlined"
          sx={{
            height: "60px",
            borderRadius: "md",
          }}
        ></Sheet>
      );
    case "queue":
    case "entry":
      return (
        <Sheet
          ref={entryClientRectRef}
          color={entry.current ? "primary" : "neutral"}
          variant={
            entry.type == "queue"
              ? "outlined"
              : entry.current
              ? "solid"
              : "soft"
          }
          sx={{
            height: "60px",
            borderRadius: "md",
            mb: entry.current && autoPlay ? "0.25rem" : "initial",
            "&::after":
              entry.current && autoPlay
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
          onMouseOver={() => setCanClose((entry.editable ?? false) && live)}
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
              badgeContent={play_freq ?? null}
              color={(play_freq && ROTATION_COLORS[play_freq]) ?? "neutral"}
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
                value={entry.song?.title ?? ""}
                current={entry.current ?? false}
                id={entry.id ?? -1}
                queue={entry.type == "queue"}
              />
              <FlowsheetEntryField
                label="artist"
                value={entry.song?.album?.artist.name ?? ""}
                current={entry.current ?? false}
                id={entry.id ?? -1}
                queue={entry.type == "queue"}
              />
              <FlowsheetEntryField
                label="album"
                value={entry.song?.album?.title ?? ""}
                current={entry.current ?? false}
                id={entry.id ?? -1}
                queue={entry.type == "queue"}
              />
              <FlowsheetEntryField
                label="label"
                value={entry.song?.album?.label ?? ""}
                current={entry.current ?? false}
                id={entry.id ?? -1}
                queue={entry.type == "queue"}
              />
            </Stack>
            {canClose && !entry.current && entry.type == "queue" && (
              <IconButton
                size="sm"
                variant="solid"
                sx={{
                  position: "absolute",
                }}
                onClick={() => {
                  addToEntries({
                    message: "",
                    song: entry.song,
                    request: entry.request,
                    rotation_id: entry.rotation_id,
                  });
                  if (entry.id) {
                    removeFromQueue(entry.id);
                  }
                }}
              >
                <PlayArrowIcon />
              </IconButton>
            )}
            <Tooltip
              variant="outlined"
              size="sm"
              title="Was this song a request?"
            >
              <Checkbox
                size="sm"
                variant="soft"
                color={entry.request ? "warning" : "neutral"}
                uncheckedIcon={<PhoneDisabledIcon />}
                checkedIcon={<PhoneEnabledIcon />}
                disabled={!(entry.editable && live)}
                sx={{
                  opacity: entry.request ? 1 : 0.3,
                  "& .MuiCheckbox-checkbox": {
                    background: "transparent",
                  },
                }}
                checked={entry.request}
                onChange={(e) => {
                    if (entry.id) {
                        if (entry.type == "queue") {
                            updateQueueEntry(entry.id, "request", !entry.request);
                        } else {
                            updateEntry(entry.id, "request", !entry.request);
                        }
                    }
                }}
              />
            </Tooltip>
            {entry.current && queue.length > 0 ? (
              <IconButton
                color="neutral"
                variant="plain"
                size="sm"
                onClick={playOffTop}
              >
                <KeyboardArrowDownIcon />
              </IconButton>
            ) : (
              entry.editable &&
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
                    entry.type == "queue"
                      ? setQueuePlaceholderIndex(entry.index)
                      : setEntryPlaceholderIndex(entry.index);
                    let rect =
                      entryClientRectRef.current.getBoundingClientRect();
                    let button = e.target.getBoundingClientRect();
                    setEntryClientRect({
                      x: rect.x,
                      y: rect.y,
                      width: rect.width,
                      height: rect.height,
                      offsetX: button.x - rect.x + 5,
                      offsetY: button.y - rect.y + 5,
                    });
                  }}
                >
                  <DragIndicatorIcon />
                </IconButton>
              )
            )}
          </Stack>
          {canClose && !entry.current && (
            <Button
              color="neutral"
              variant="solid"
              sx={{
                position: "absolute",
                zIndex: 4,
                top: "50%",
                transform: "translateY(-50%)",
                right: 10,
                minWidth: "3px",
                minHeight: "3px",
                maxWidth: "3px",
                maxHeight: "3px",
                background: "transparent",
                p: 0,
                "& svg": {
                  width: "15px",
                  height: "15px",
                },
                "&:hover": {
                  background: "transparent",
                },
              }}
              onClick={() => {
                var remove = {
                  queue: removeFromQueue,
                  entry: removeFromEntries,
                }[entry.type];
                remove(entry.id);
              }}
            >
              <ClearIcon color="neutral" />
            </Button>
          )}
          {entry.current && autoPlay && (
            <div
              style={{
                position: "absolute",
                bottom: "-0.3rem",
                left: "10px",
                width: "calc(100% - 10px)",
                display: "flex",
                flexDirection: "row",
              }}
            >
              <div
                style={{
                  flexGrow: 1,
                  display: "flex",
                  justifyContent: "flex-end",
                }}
              >
                <LinearProgress
                  color="primary"
                  determinate
                  variant="solid"
                  value={
                    ((currentTimeStamp?.total ?? 0) /
                      (currentlyPlayingSongLength?.total ?? 1)) *
                    100
                  }
                  thickness={2}
                  sx={{
                    bgcolor: "transparent",
                  }}
                />
              </div>
              <div
                style={{
                  marginLeft: "5px",
                  marginRight: "22.5px",
                }}
              >
                <Typography
                  level="body-sm"
                  sx={{ mt: -0.25 }}
                  textColor={"neutral.100"}
                >
                  {currentTimeStamp.h > 0 && currentTimeStamp.h + ":"}
                  {currentTimeStamp.m < 10 && "0"}
                  {currentTimeStamp.m}:{currentTimeStamp.s < 10 && "0"}
                  {currentTimeStamp.s}
                </Typography>
              </div>
            </div>
          )}
        </Sheet>
      );
    case "joined":
    case "left":
      return (
        <Sheet
          color="info"
          variant="solid"
          sx={{
            height: "40px",
            borderRadius: "md",
          }}
        >
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
            spacing={1}
            sx={{
              height: "100%",
              p: 1,
            }}
          >
            <Typography textColor="info.400">
              {entry.type === "joined" ? (
                <HeadphonesIcon sx={{ mb: -0.5 }} />
              ) : (
                <LogoutIcon sx={{ mb: -0.5 }} />
              )}
            </Typography>
            <Typography
              level="body-lg"
              endDecorator={
                <Typography
                  textColor={"info.400"}
                >{`${entry.type} the set!`}</Typography>
              }
            >
              {entry.message?.split(` ${entry.type}`)?.[0] ??
                "Processing Error"}
            </Typography>
            <div></div>
          </Stack>
        </Sheet>
      );
    case "breakpoint":
      return (
        <Sheet
          color="warning"
          variant="plain"
          sx={{
            height: "40px",
            borderRadius: "md",
          }}
          onMouseOver={() => setCanClose(entry.editable && live)}
          onMouseLeave={() => setCanClose(false)}
        >
          {canClose && (
            <Button
              color="neutral"
              variant="solid"
              sx={{
                position: "absolute",
                zIndex: 4,
                top: "50%",
                transform: "translateY(-50%)",
                right: 10,
                minWidth: "3px",
                minHeight: "3px",
                maxWidth: "3px",
                maxHeight: "3px",
                background: "transparent",
                p: 0,
                "& svg": {
                  width: "15px",
                  height: "15px",
                },
                "&:hover": {
                  background: "transparent",
                },
              }}
              onClick={() => {
                removeFromEntries(entry.id);
              }}
            >
              <ClearIcon color="neutral" />
            </Button>
          )}
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
            spacing={1}
            sx={{
              height: "100%",
              p: 1,
            }}
          >
            <Typography color="warning">
              <TimerIcon sx={{ mb: -0.5 }} />
            </Typography>
            <Typography level="body-lg" color="warning">
              {entry.message ?? "Processing Error"}
            </Typography>
            <div></div>
          </Stack>
        </Sheet>
      );
    case "talkset":
      return (
        <Sheet
          color="success"
          variant="solid"
          sx={{
            height: "40px",
            borderRadius: "md",
          }}
          onMouseOver={() => setCanClose(entry.editable && live)}
          onMouseLeave={() => setCanClose(false)}
        >
          {canClose && (
            <Button
              color="neutral"
              variant="solid"
              sx={{
                position: "absolute",
                zIndex: 4,
                top: "50%",
                transform: "translateY(-50%)",
                right: 10,
                minWidth: "3px",
                minHeight: "3px",
                maxWidth: "3px",
                maxHeight: "3px",
                background: "transparent",
                p: 0,
                "& svg": {
                  width: "15px",
                  height: "15px",
                },
                "&:hover": {
                  background: "transparent",
                },
              }}
              onClick={() => {
                removeFromEntries(entry.id);
              }}
            >
              <ClearIcon color="neutral" />
            </Button>
          )}
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
            spacing={1}
            sx={{
              height: "100%",
              p: 1,
            }}
          >
            <Typography
              textColor="success.400"
              sx={{
                alignSelf: "flex-start",
              }}
            >
              <MicIcon sx={{ mb: -0.7 }} />
            </Typography>
            <Typography level="body-lg">
              {entry.message ?? "Processing Error"}
            </Typography>
            <div></div>
          </Stack>
        </Sheet>
      );
    default:
      return (
        <Sheet
          color="danger"
          variant="solid"
          sx={{
            height: "40px",
            borderRadius: "md",
          }}
          onMouseOver={() => setCanClose(entry.editable && live)}
          onMouseLeave={() => setCanClose(false)}
        >
          {canClose && (
            <Button
              color="neutral"
              variant="solid"
              sx={{
                position: "absolute",
                zIndex: 4,
                top: "50%",
                transform: "translateY(-50%)",
                right: 10,
                minWidth: "3px",
                minHeight: "3px",
                maxWidth: "3px",
                maxHeight: "3px",
                background: "transparent",
                p: 0,
                "& svg": {
                  width: "15px",
                  height: "15px",
                },
                "&:hover": {
                  background: "transparent",
                },
              }}
              onClick={() => {
                removeFromEntries(entry.id);
              }}
            >
              <ClearIcon color="info" />
            </Button>
          )}
          <Stack
            direction="row"
            justifyContent="center"
            alignItems="center"
            spacing={1}
            sx={{
              height: "100%",
              p: 1,
            }}
          >
            <Typography level="body-lg">
              {entry.message ?? "Processing Error"}
            </Typography>
          </Stack>
        </Sheet>
      );
  }
};

export default SongBox;
