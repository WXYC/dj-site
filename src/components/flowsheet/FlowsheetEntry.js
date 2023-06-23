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
import React, { useCallback, useEffect, useState } from "react";
import { getArtwork } from "../../services/artwork/artwork-service";

const FlowsheetEntry = (props) => {
    const [image, setImage] = useState(null);

    const [canClose, setCanClose] = useState(false);
  
    const getImage = useCallback(async () => {
      let storedArtwork = sessionStorage.getItem(
        `${props.releaseAlbum}-${props.releaseArtist}`
      );
      if (storedArtwork) return storedArtwork;
      try {
        let retrievedArtwork = await getArtwork({
          title: props.releaseAlbum,
          artist: props.releaseArtist,
        });
        // THE CONVENTION IS ALBUM THEN ARTIST IN THIS APP
        sessionStorage.setItem(
          `${props.releaseAlbum}-${props.releaseArtist}`,
          retrievedArtwork
        );
        return retrievedArtwork;
      } catch (e) {
        sessionStorage.setItem(
          `${props.releaseAlbum}-${props.releaseArtist}`,
          ""
        );
        return "";
      }
    }, [props.releaseAlbum, props.releaseArtist]);
  
    useEffect(() => {
      getImage().then((image) => {
        setImage(image);
      });
    }, [getImage]);
  
    switch (props.type) {
      case "placeholder":
        return (
          <Sheet
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
            color={props.current ? "primary" : "neutral"}
            variant={(props.type == "queue") ? "outlined" : (props.current ? "solid" : "soft")}
            sx={{
              height: '60px',
              borderRadius: "md",
            }}
            onMouseOver={() => setCanClose(true)}
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
              <Stack direction="row" sx={{ flexGrow: 1 }} spacing={1}>
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
                    {props.releaseTitle}
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
                    {props.releaseArtist}
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
                    {props.releaseAlbum}
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
                    {props.releaseLabel}
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
                >
                    <PlayArrowIcon />
                </IconButton>
              )}
              {props.current ? (
                <IconButton color="neutral" variant="plain" size="sm">
                  <KeyboardArrowDownIcon />
                </IconButton>
              ) : (
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
                >
                  <DragIndicatorIcon />
                </IconButton>
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