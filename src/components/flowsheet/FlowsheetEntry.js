import ClearIcon from '@mui/icons-material/Clear';
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import HeadphonesIcon from "@mui/icons-material/Headphones";
import PhoneDisabledIcon from '@mui/icons-material/PhoneDisabled';
import PhoneEnabledIcon from '@mui/icons-material/PhoneEnabled';
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import LogoutIcon from "@mui/icons-material/Logout";
import MicIcon from "@mui/icons-material/Mic";
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import TimerIcon from "@mui/icons-material/Timer";
import {
    AspectRatio,
    Button,
    Checkbox,
    CircularProgress,
    IconButton,
    Input,
    LinearProgress,
    Sheet,
    Stack,
    Tooltip,
    Typography
} from "@mui/joy";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { getArtwork } from "../../services/artwork/artwork-service";
import { useFlowsheet } from '../../services/flowsheet/flowsheet-context';
import { useLive } from '../../services/flowsheet/live-context';
import { ClickAwayListener } from '@mui/material';


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
      updateQueueEntry,
      removeFromQueue, 
      removeFromEntries, 
      queuePlaceholderIndex, 
      entryPlaceholderIndex,
      setQueuePlaceholderIndex,
      setEntryPlaceholderIndex,
      entryClientRect,
      setEntryClientRect,
      addToEntries,
      updateEntry,
      autoPlay,
      currentlyPlayingSongLength,
      currentTimeStamp,
      playOffTop
    } = useFlowsheet();

    const [image, setImage] = useState(null);

    const entryClientRectRef = useRef(null);

    const [canClose, setCanClose] = useState(false);
    const { live } = useLive();
  
    const getImage = useCallback(async (default_return = "") => {
      if (props.album == undefined || props.artist == undefined) return default_return;
      let storedArtwork = sessionStorage.getItem(
        `img-${props.album}-${props.artist}`
      );
      if (storedArtwork) return storedArtwork;
      try {
        let retrievedArtwork = await getArtwork({
          title: props.album,
          artist: props.artist,
        });
        if (retrievedArtwork == null) return default_return;
        // THE CONVENTION IS ALBUM THEN ARTIST IN THIS APP
        sessionStorage.setItem(
          `img-${props.album}-${props.artist}`,
          retrievedArtwork
        );
        return retrievedArtwork;
      } catch (e) {
        sessionStorage.setItem(
          `img-${props.album}-${props.artist}`,
          default_return
        );
        return default_return;
      }
    }, [props.album, props.artist]);
  
    useEffect(() => {
      getImage("apple-touch-icon.png").then((image) => {
        setImage(image);
      });
    }, [getImage]);

    const FlowsheetEntryField = (props) => {

      const { updateEntry, updateQueueEntry } = useFlowsheet();
      const { live } = useLive();
      
      const [editing, setEditing] = useState(false);
      const [value, setValue] = useState(props.value ?? "");
  
      const saveAndClose = (e) => {
        e.preventDefault();
        setEditing(false);
        let label = props.label == "song" ? "title" : props.label; // Hack to handle stylistic choice of 'song' over 'title'
        if (props.queue) {
          updateQueueEntry(props.id, label, value);
        } else {
          updateEntry(props.id, label, value);
        }
      }
  
      return (
        <Stack direction="column" sx={{ width: "calc(25%)" }}>
        <Typography level="body4" sx={{ mb: -1 }} textColor={props.current ? "primary.300" : "unset"}>
          {props.label.toUpperCase()}
        </Typography>
        {(editing) ? (
          <ClickAwayListener onClickAway={saveAndClose}>
          <form onSubmit={saveAndClose}>
          <Typography
          textColor={props.current ? "primary.lightChannel" : "unset"}
          sx={{
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            borderBottom: '1px solid',
          }}>
          <input 
            type='text'
            style = {{
              color: 'inherit',
              fontFamily: 'inherit',
              fontSize: 'inherit',
              fontWeight: 'inherit',
              background: 'transparent',
              width: '100%',
              border: 'none',
              outline: 'none',
              padding: '0',
              margin: '0',
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
        )
        : (<Typography
          textColor={props.current ? "primary.lightChannel" : "unset"}
          sx={{
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            cursor: 'text',
            minWidth: '10px',
          }}
          onDoubleClick={() => setEditing(live)}
        >
          {props.value}&nbsp;
        </Typography>)}
      </Stack>
      )
    }
  
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
              mb: (props.current && autoPlay) ? '0.25rem' : 'initial',
              '&::after': (props.current && autoPlay) ? {
                content: '""',
                bgcolor: 'var(--joy-palette-primary-solidBg, var(--joy-palette-primary-500, #096BDE))',
                position: 'absolute',
                bottom: '-0.25rem',
                top: 'calc(100% - 1rem)',
                zIndex: -1,
                borderBottomRightRadius: '0.7rem',
                borderBottomLeftRadius: '0.7rem',
                left: 0,
                right: 0,
              } : {},
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
                  minWidth: "48px",
                  minHeight: "48px",
                }}
              >
                  <img src={image} alt="album art" style={{ minWidth: '48px', minHeight: '48px' }} />
              </AspectRatio>
              <Stack direction="row" sx={{ flexGrow: 1, maxWidth: 'calc(100% - 98px)' }} spacing={1}>
                <FlowsheetEntryField label="song" value={props.title} current={props.current} id={props.id} queue={props.type == "queue"} />
                <FlowsheetEntryField label="artist" value={props.artist} current={props.current} id={props.id} queue={props.type == "queue"} />
                <FlowsheetEntryField label="album" value={props.album} current={props.current} id={props.id} queue={props.type == "queue"} />
                <FlowsheetEntryField label="label" value={props.label} current={props.current} id={props.id} queue={props.type == "queue"} />
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
                        request: props.request,
                      });
                      removeFromQueue(props.id);
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
                color={props.request ? "warning" : "neutral"}
                uncheckedIcon={<PhoneDisabledIcon />}
                checkedIcon={<PhoneEnabledIcon />}
                disabled={!live}
                sx = {{
                  opacity: props.request ? 1 : 0.3,
                  '& .MuiCheckbox-checkbox' : {
                    background: 'transparent'
                  }
                }}
                checked={props.request}
                onChange={(e) => {
                  if (props.type == "queue") {
                    updateQueueEntry(props.id, "request", !props.request);
                  } else {
                    updateEntry(props.id, "request", !props.request);
                  }
                }}
              />
              </Tooltip>
              {props.current && (queue.length > 0) ? (
                <IconButton color="neutral" variant="plain" size="sm"
                  onClick={playOffTop}
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
                    background: 'transparent',
                    p: 0,
                    '& svg': {
                        width: '15px',
                        height: '15px',
                    },
                    '&:hover': {
                        background: 'transparent',
                    },
                }}
                onClick={() => {
                  var remove = {"queue" : removeFromQueue, "entry" : removeFromEntries}[props.type];
                  remove(props.id);
                }}
            >
                <ClearIcon color="neutral"/>
            </Button>)}
            {(props.current && autoPlay) && (<div
              style = {{
                position: 'absolute',
                bottom: '-0.3rem',
                left: '10px',
                width: 'calc(100% - 10px)',
                display: 'flex',
                flexDirection: 'row',
              }}
            >
              <div
                style = {{
                  flexGrow: 1,
                  display: 'flex',
                  justifyContent: 'flex-end',
                }}
              >
                <LinearProgress
                  color='primary'
                  determinate
                  variant="solid"
                  value={(currentTimeStamp?.total ?? 0) / (currentlyPlayingSongLength?.total ?? 1) * 100}
                  thickness={2}
                  sx = {{
                    bgcolor: 'transparent'
                  }}
                />
              </div>
              <div
                style = {{
                  marginLeft: '5px',
                  marginRight: '22.5px',
                }}
              >
              <Typography
                level="body4"
                sx = {{ mt: -0.25 }}
                textColor={'neutral.100'}
              >
                {currentTimeStamp.h > 0 && currentTimeStamp.h + ":"}{currentTimeStamp.m < 10 && "0"}{currentTimeStamp.m}:{currentTimeStamp.s < 10 && "0"}{currentTimeStamp.s}
              </Typography>
              </div>
            </div>)}
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
                {props.type === "joined" ? (
                  <HeadphonesIcon sx={{ mb: -0.5 }} />
                ) : (
                  <LogoutIcon sx={{ mb: -0.5 }} />
                )}
              </Typography>
              <Typography
                level="body1"
                endDecorator={
                  <Typography textColor={"info.400"}>{`${props.type} the set!`}</Typography>
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
            onMouseOver = {() => setCanClose(live)}
            onMouseLeave = {() => setCanClose(false)}
          >
                        {(canClose) && (
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
                    background: 'transparent',
                    p: 0,
                    '& svg': {
                        width: '15px',
                        height: '15px',
                    },
                    '&:hover': {
                        background: 'transparent',
                    },
                }}
                onClick={() => {
                  removeFromEntries(props.id);
                }}
            >
                <ClearIcon color="neutral"/>
            </Button>)}
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
            onMouseOver = {() => setCanClose(live)}
            onMouseLeave = {() => setCanClose(false)}
          >
          {(canClose) && (
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
                    background: 'transparent',
                    p: 0,
                    '& svg': {
                        width: '15px',
                        height: '15px',
                    },
                    '&:hover': {
                        background: 'transparent',
                    },
                }}
                onClick={() => {
                  removeFromEntries(props.id);
                }}
            >
                <ClearIcon color="neutral"/>
            </Button>)}
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
            onMouseOver = {() => setCanClose(live)}
            onMouseLeave = {() => setCanClose(false)}
          >
          {(canClose) && (
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
                    background: 'transparent',
                    p: 0,
                    '& svg': {
                        width: '15px',
                        height: '15px',
                    },
                    '&:hover': {
                        background: 'transparent',
                    },
                }}
                onClick={() => {
                  removeFromEntries(props.id);
                }}
            >
                <ClearIcon color="neutral"/>
            </Button>)}
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