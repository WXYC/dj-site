import ClearIcon from '@mui/icons-material/Clear';
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import HeadphonesIcon from "@mui/icons-material/Headphones";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import LogoutIcon from "@mui/icons-material/Logout";
import MicIcon from "@mui/icons-material/Mic";
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import TimerIcon from "@mui/icons-material/Timer";
import {
    AspectRatio,
    Button,
    CircularProgress,
    IconButton,
    Sheet,
    Stack,
    Typography
} from "@mui/joy";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { getArtwork } from "../../services/artwork/artwork-service";
import { useFlowsheet } from '../../services/flowsheet/flowsheet-context';
import { useLive } from '../../services/flowsheet/live-context';


/**
 * Represents a Flowsheet Entry component. Contains self-delete and play functionality.
 * @component
 * @category Flowsheet
 *
 * @param {Object} props - The component props.
 * @param {string} props.type - The type of the entry. Possible values: "placeholder", "queue", "entry", "joined", "left", "breakpoint", "talkset".
 * @param {string} [props.album] - The album name.
 * @param {string} [props.artist] - The artist name.
 * @param {string} [props.title] - The song title.
 * @param {string} [props.label] - The label.
 * @param {boolean} [props.current] - Indicates if the entry is the current one.
 * @param {string} [props.id] - The entry ID.
 * @param {string} [props.message] - The entry message. If message is "", then it is an entry. If it is not blank, then it is a placeholder for a talkset, joined, left, or breakpoint notification.
 *
 * @returns {JSX.Element} The FlowsheetEntry component.
 */
const FlowsheetEntry = (props) => {

    const { 
      queue,
      removeFromQueue, 
      removeFromEntries, 
      queuePlaceholderIndex, 
      entryPlaceholderIndex,
      setQueuePlaceholderIndex,
      setEntryPlaceholderIndex,
      entryClientRect,
      setEntryClientRect,
      addToEntries,
    } = useFlowsheet();

    const [image, setImage] = useState(null);

    const entryClientRectRef = useRef(null);

    const [canClose, setCanClose] = useState(false);
    const { live } = useLive();
  
    const getImage = useCallback(async () => {
      if (props.album == undefined || props.artist == undefined) return "";
      let storedArtwork = sessionStorage.getItem(
        `img-${props.album}-${props.artist}`
      );
      if (storedArtwork) return storedArtwork;
      try {
        let retrievedArtwork = await getArtwork({
          title: props.album,
          artist: props.artist,
        });
        // THE CONVENTION IS ALBUM THEN ARTIST IN THIS APP
        sessionStorage.setItem(
          `img-${props.album}-${props.artist}`,
          retrievedArtwork
        );
        return retrievedArtwork;
      } catch (e) {
        sessionStorage.setItem(
          `img-${props.album}-${props.artist}`,
          ""
        );
        return "";
      }
    }, [props.album, props.artist]);
  
    useEffect(() => {
      getImage().then((image) => {
        setImage(image);
      });
    }, [getImage]);
  
    switch (props.type) {
      case "placeholder":
        return (
          <Sheet
            color={(props.current ? "primary" : "neutral")}
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
            color={props.current ? "primary" : "neutral"}
            variant={(props.type == "queue") ? "outlined" : (props.current ? "solid" : "soft")}
            sx={{
              height: '60px',
              borderRadius: "md",
            }}
            onMouseOver={() => setCanClose(live)}
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
              <AspectRatio
                ratio={1}
                sx={{
                  flexBasis: "calc(60px - 12px)",
                  borderRadius: "9px",
                }}
              >
                {image ? (
                  <img src={image} alt="album art" />
                ) : (
                  <CircularProgress size="sm" />
                )}
              </AspectRatio>
              <Stack direction="row" sx={{ flexGrow: 1, maxWidth: 'calc(100% - 98px)' }} spacing={1}>
                <Stack direction="column" sx={{ width: "calc(25%)" }}>
                  <Typography level="body4" sx={{ mb: -1 }}>
                    SONG
                  </Typography>
                  <Typography
                    sx={{
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {props.title}
                  </Typography>
                </Stack>
                <Stack direction="column" sx={{ width: "calc(25%)" }}>
                  <Typography level="body4" sx={{ mb: -1 }}>
                    ARTIST
                  </Typography>
                  <Typography
                    sx={{
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {props.artist}
                  </Typography>
                </Stack>
                <Stack direction="column" sx={{ width: "calc(25%)" }}>
                  <Typography level="body4" sx={{ mb: -1 }}>
                    ALBUM
                  </Typography>
                  <Typography
                    sx={{
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {props.album}
                  </Typography>
                </Stack>
                <Stack direction="column" sx={{ width: "calc(25%)" }}>
                  <Typography level="body4" sx={{ mb: -1 }}>
                    LABEL
                  </Typography>
                  <Typography
                    sx={{
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {props.label}
                  </Typography>
                </Stack>
              </Stack>
              {(canClose && !props.current && props.type == "queue") && (
                <IconButton
                    size="sm"
                    variant="solid"
                    sx = {{
                        position: 'absolute',
                    }}
                    onClick={() => {
                      addToEntries({
                        message: "",
                        title: props.title,
                        artist: props.artist,
                        album: props.album,
                        label: props.label,
                      });
                      removeFromQueue(props.id);
                    }}
                >
                    <PlayArrowIcon />
                </IconButton>
              )}
              {props.current && (queue.length > 0) ? (
                <IconButton color="neutral" variant="plain" size="sm"
                  onClick={() => {
                    addToEntries(queue[queue.length - 1]);
                    removeFromQueue(queue.length);
                  }}
                >
                  <KeyboardArrowDownIcon />
                </IconButton>
              ) : (
                (live) && (<IconButton
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
                    props.type == "queue" ? setQueuePlaceholderIndex(props.index) : setEntryPlaceholderIndex(props.index);
                    let rect = entryClientRectRef.current.getBoundingClientRect();
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
                </IconButton>)
              )}
            </Stack>
            {(canClose && !props.current) && (
            <Button
                color="neutral"
                variant="solid"
                sx = {{
                    position: 'absolute',
                    zIndex: 4,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    right: 10,
                    minWidth: '3px',
                    minHeight: '3px',
                    maxWidth: '3px',
                    maxHeight: '3px',
                    p: 0,
                    '& svg': {
                        width: '15px',
                        height: '15px',
                    }
                }}
                onClick={() => {
                  var remove = {"queue" : removeFromQueue, "entry" : removeFromEntries}[props.type];
                  remove(props.id);
                }}
            >
                <ClearIcon />
            </Button>)}
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
              <Typography color="info">
                {props.type === "joined" ? (
                  <HeadphonesIcon sx={{ mb: -0.5 }} />
                ) : (
                  <LogoutIcon sx={{ mb: -0.5 }} />
                )}
              </Typography>
              <Typography
                level="body1"
                endDecorator={
                  <Typography color="info">{`${props.type} the set!`}</Typography>
                }
              >
                {props.message?.split(` ${props.type}`)?.[0] ??
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
              <Typography color="warning">
                <TimerIcon sx={{ mb: -0.5 }} />
              </Typography>
              <Typography level="body1" color="warning">
                {props.message ?? "Processing Error"}
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
              <Typography
                color="success"
                sx={{
                  alignSelf: "flex-start",
                }}
              >
                <MicIcon sx={{ mb: -0.7 }} />
              </Typography>
              <Typography level="body1">
                {props.message ?? "Processing Error"}
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
          >
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
              <Typography level="body1">
                {props.message ?? "Processing Error"}
              </Typography>
            </Stack>
          </Sheet>
        );
    }
  };

  export default FlowsheetEntry;