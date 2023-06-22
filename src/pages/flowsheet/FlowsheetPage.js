import { AspectRatio, Box, Checkbox, CircularProgress, Divider, IconButton, Sheet, Stack, Typography } from "@mui/joy";
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import MicIcon from '@mui/icons-material/Mic';
import HeadphonesIcon from '@mui/icons-material/Headphones';
import TimerIcon from '@mui/icons-material/Timer';
import LogoutIcon from '@mui/icons-material/Logout';
import React, { useCallback, useEffect, useState } from "react";
import { getArtwork } from "../../services/artwork/artwork-service";

const exampleEntries = [
    {
        message: "",
        releaseTitle: "Sleep",
        releaseAlbum: "How Did We Get So Dark?",
        releaseArtist: "Royal Blood",
        releaseLabel: "Warner Records",
        request: false,
    },
    {
        message: "DJ Turncoat left",
        releaseTitle: "",
        releaseAlbum: "",
        releaseArtist: "",
        releaseLabel: "",
        request: false,
    },
    {
        message: "",
        releaseTitle: "The Way You Used To Do",
        releaseAlbum: "Villains",
        releaseArtist: "Queens of the Stone Age",
        releaseLabel: "Matador Records",
        request: false,
    },
    {
        message: "",
        releaseTitle: "Cat Food",
        releaseAlbum: "In the Court of the Crimson King",
        releaseArtist: "King Crimson",
        releaseLabel: "Island Records",
        request: false,
    },
    {
        message: "DJ Turncoat joined",
        releaseTitle: "",
        releaseAlbum: "",
        releaseArtist: "",
        releaseLabel: "",
        request: false,
    },
    {
        message: "",
        releaseTitle: "Engineers",
        releaseAlbum: "MLDE",
        releaseArtist: "Marxist Love Disco Ensemble",
        releaseLabel: "Self-Released",
        request: true,
    },
    {
        message: "2:00 AM Breakpoint",
        releaseTitle: "",
        releaseAlbum: "",
        releaseArtist: "",
        releaseLabel: "",
        request: false,
    },
    {
        message: "Talkset",
        releaseTitle: "",
        releaseAlbum: "",
        releaseArtist: "",
        releaseLabel: "",
        request: false,
    },
]

const FlowSheetPage = () => {

    const FlowsheetEntry = (props) => {

        const [image, setImage] = useState(null);

        const getImage = useCallback(async () => {
            let storedArtwork = sessionStorage.getItem(`${props.releaseAlbum}-${props.releaseArtist}`);
            if (storedArtwork) return storedArtwork;
            try {
                let retrievedArtwork = await getArtwork({
                    title: props.releaseAlbum,
                    artist: props.releaseArtist
                });
                // THE CONVENTION IS ALBUM THEN ARTIST IN THIS APP
                sessionStorage.setItem(`${props.releaseAlbum}-${props.releaseArtist}`, retrievedArtwork);
                return retrievedArtwork;
            } catch (e) {
                sessionStorage.setItem(`${props.releaseAlbum}-${props.releaseArtist}`, '');
                return '';
            }
        }, [props.releaseAlbum, props.releaseArtist]);

        useEffect(() => {
            getImage().then((image) => {
                setImage(image);
                console.log(image);
            });
        }, [getImage]);

        switch (props.type) {
            case "placeholder":
                return (
                    <Sheet
                        variant="outlined"
                        sx = {{
                            height: '60px',
                            borderRadius: 'md',
                        }}
                    >
                        
                    </Sheet>
                );
            case "entry":
                return (
                    <Sheet
                        color={props.current ? "primary" : "neutral"}
                        variant={props.current ? "solid" : "soft"}
                        sx = {{
                            height: '60px',
                            borderRadius: 'md',
                        }}
                    >
                        <Stack 
                            direction="row" 
                            justifyContent="space-between" 
                            alignItems="center"
                            spacing={1}
                            sx = {{
                                height: '100%',
                                p: 1,
                                pr: 2,
                            }}
                        >
                            <AspectRatio ratio={1}
                                sx = {{ 
                                    flexBasis: 'calc(60px - 12px)',
                                    borderRadius: '9px',
                                }}
                            >
                                {(image) ? 
                                    (<img src={image} alt="album art" />) : 
                                    (<CircularProgress size="sm" />)}
                            </AspectRatio>
                            <Stack direction="row" sx = {{ flexGrow: 1 }} spacing={1}>
                                    <Stack direction="column" sx = {{ width: 'calc(25%)' }}>
                                        <Typography level="body4" sx={{ mb: -1 }}>SONG</Typography>
                                        <Typography sx = {{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{props.releaseTitle}</Typography>
                                    </Stack>
                                    <Stack direction="column" sx = {{ width: 'calc(25%)' }}>
                                        <Typography level="body4" sx={{ mb: -1 }}>ALBUM</Typography>
                                        <Typography sx = {{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{props.releaseAlbum}</Typography>
                                    </Stack>
                                    <Stack direction="column" sx = {{ width: 'calc(25%)' }}>
                                        <Typography level="body4" sx={{ mb: -1 }}>ARTIST</Typography>
                                        <Typography sx = {{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{props.releaseArtist}</Typography>
                                    </Stack>
                                    <Stack direction="column" sx = {{ width: 'calc(25%)' }}>
                                        <Typography level="body4" sx={{ mb: -1 }}>LABEL</Typography>
                                        <Typography sx = {{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{props.releaseLabel}</Typography>
                                    </Stack>
                            </Stack>
                            {(props.current) ? (
                                <IconButton
                                color="neutral"
                                variant="plain"
                                size="sm"
                            >
                                <KeyboardArrowDownIcon />
                            </IconButton>
                            ) : (<IconButton
                                color="neutral"
                                variant="plain"
                                size="sm"
                                sx = {{
                                    cursor: 'grab',
                                    '&:hover': {
                                        background: 'none',
                                    },
                                }}
                            >
                                <DragIndicatorIcon />
                            </IconButton>)}
                        </Stack>
                    </Sheet>
                );
            case "joined":
            case "left":
                return (
                    <Sheet
                        color="info"
                        variant="solid"
                        sx = {{
                            height: '40px',
                            borderRadius: 'md',
                        }}
                    >
                        <Stack 
                            direction="row" 
                            justifyContent="space-between" 
                            alignItems="center"
                            spacing={1}
                            sx = {{
                                height: '100%',
                                p: 1,
                            }}
                        >
                            
                            <Typography color="info">
                                    {(props.type === "joined" ?
                                    (<HeadphonesIcon sx = {{ mb: -0.5 }} />) :
                                    (<LogoutIcon sx = {{ mb: -0.5 }} />))}
                            </Typography>
                            <Typography level="body1"
                                endDecorator = {
                                    <Typography color="info">
                                    {`${props.type} the set!`}
                                    </Typography>
                                }
                            >
                                {props.message?.split(` ${props.type}`)?.[0] ?? "Processing Error"}

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
                        sx = {{
                            height: '40px',
                            borderRadius: 'md',
                        }}
                    >
                        <Stack
                            direction="row"
                            justifyContent="space-between"
                            alignItems="center"
                            spacing={1}
                            sx = {{
                                height: '100%',
                                p: 1,
                            }}
                        >
                                <Typography color="warning">
                                    <TimerIcon sx = {{ mb: -0.5 }} />
                                </Typography>
                            <Typography level="body1"
                                color="warning"
                            >
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
                        sx = {{
                            height: '40px',
                            borderRadius: 'md',
                        }}
                    >
                        <Stack
                            direction="row"
                            justifyContent="space-between"
                            alignItems="center"
                            spacing={1}
                            sx = {{
                                height: '100%',
                                p: 1,
                            }}
                        >
                            
                            <Typography color="success"
                                sx = {{
                                    alignSelf: 'flex-start'
                                }}
                            >
                                    <MicIcon sx = {{ mb: -0.7 }} />
                            </Typography>
                            <Typography level="body1"
                            >
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
                        sx = {{
                            height: '40px',
                            borderRadius: 'md',
                        }}
                    >
                        <Stack
                            direction="row"
                            justifyContent="center"
                            alignItems="center"
                            spacing={1}
                            sx = {{
                                height: '100%',
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
    }

    // THIS IS WHERE THE PAGE BEGINS ---------------------------------------------
    return (
                <>
        <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          my: 1,
          gap: 1,
          flexWrap: 'wrap',
          '& > *': {
            minWidth: 'clamp(0px, (500px - 100%) * 999, 100%)',
            flexGrow: 1,
          },
        }}
      >
        <Typography level="h1">
          Flowsheet
        </Typography>
        <Box sx = {{ flex: 999 }}></Box>
    </Box>
    <Sheet
        sx = {{
            maxHeight: 'calc(100vh - 200px)',
            overflowY: 'auto',
            background: 'transparent',
        }}
    >
    <Stack direction="column" spacing={1}>
        {exampleEntries.map((entry, index) => {
            return (
                <FlowsheetEntry
                    type={
                        (entry?.message?.length > 0 ? 
                            (entry?.message?.includes("joined") ? 
                                "joined" : 
                                (entry?.message?.includes("left") ?
                                    "left" :
                                    entry?.message?.includes("Breakpoint") ?
                                        "breakpoint" :
                                        entry?.message?.includes("Talkset") ?
                                            "talkset" :
                                            "error")) 
                            : "entry")
                    }
                    current={index === 0}
                    {...entry}
                />
            );
        })}
    </Stack>
    </Sheet>
        </>
    )
}

export default FlowSheetPage;