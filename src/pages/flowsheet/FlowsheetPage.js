import { AspectRatio, Box, Checkbox, Chip, CircularProgress, Divider, FormControl, FormLabel, IconButton, Input, Sheet, Stack, Typography } from "@mui/joy";
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import TroubleshootIcon from '@mui/icons-material/Troubleshoot';
import MicIcon from '@mui/icons-material/Mic';
import HeadphonesIcon from '@mui/icons-material/Headphones';
import TimerIcon from '@mui/icons-material/Timer';
import LogoutIcon from '@mui/icons-material/Logout';
import React, { useCallback, useEffect, useRef, useState } from "react";
import { getArtwork } from "../../services/artwork/artwork-service";
import { ClickAwayListener } from "@mui/material";

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

    // THIS IS WHERE THE PAGE BEGINS ---------------------------------------------
    const searchRef = useRef(null);
    const [searching, setSearching] = useState(false);

    const [searchstring, setSearchstring] = useState('');
    const [selected, setSelected] = useState(0);
    const [searchType, setSearchType] = useState('title'); // ['title', 'artist', 'album', 'label']
    const [fieldStrings, setFieldStrings] = useState({
        title: '',
        artist: '',
        album: '',
        label: '',
    });

    const handleSearchDown = (e) => {
        if (e.key === '/') {
            e.preventDefault();
            // get input child from searchRef
            const input = searchRef.current.querySelector('input');
            input.focus();
        }
        if (searchRef.current.querySelector('input') === document.activeElement) {
            if (e.key === 'Escape') {
                e.preventDefault();
                e.target.blur();
            }
            else if (e.key === 'Tab') {
                e.preventDefault();
                let newSearchMap = null;
                if (e.shiftKey) {
                    newSearchMap = {
                        title: 'label',
                        artist: 'title',
                        album: 'artist',
                        label: 'album',
                    }
                } else {
                    newSearchMap = {
                        title: 'artist',
                        artist: 'album',
                        album: 'label',
                        label: 'title',
                    } 
                }
                setSearchstring('');
                setSearchType((previous) => newSearchMap[previous]);
            }
            else if (e.keyCode === 38) {
                e.preventDefault();
                setSelected((previous) => Math.max(0, previous - 1));
            }
            else if (e.keyCode === 40) {
                e.preventDefault();
                setSelected((previous) => Math.min(exampleEntries.length - 1, previous + 1));
            }
        }
    };

    const closeSearch = () => {
        setSearching(false);
        setSearchstring('');
        setSelected(0);
        setSearchType('title');
        setFieldStrings({
            title: '',
            artist: '',
            album: '',
            label: '',
        });
    };

    const handleSearchFocused = (e) => {
        setSearching(true);
    };

    const handleSearchChange = (e) => {
        setSearchstring(e.target.value);
        let newFieldStrings = {...fieldStrings};
        newFieldStrings[searchType] = e.target.value;
        setFieldStrings(newFieldStrings);
    };
    
    useEffect(() => {
        document.addEventListener('keydown', handleSearchDown);
        return () => {
            document.removeEventListener('keydown', handleSearchDown);
        };
    }, []);

    // THIS IS WHERE THE PAGE RENDER BEGINS ---------------------------------------------
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
    <FormControl size="sm">
        {(searching) && (
        <Sheet
            variant="outlined"
            sx = {{
                minHeight: '60px',
                position: 'absolute',
                top: -5,
                left: -5,
                right: -5,
                zIndex: 1,
                borderRadius: 'md',
                transition: 'height 0.2s ease-in-out',
                boxShadow: '0px 34px 24px -9px rgba(0,0,0,0.7)',
            }}
          >
            <Box
                sx = {{
                    mt: '40px',
                    position: 'relative',
                    minHeight: '40px',
                    pb: '40px',
                    transition: 'height 0.2s ease-in-out',
                }}
            >
                {((searchstring.length + 
                Object.keys(fieldStrings).reduce(
                    (total, item) => { return total + fieldStrings[item].length},
                    0
                )) > 0) && (
                    <Box
                        sx = {{
                            p: 1,
                            backgroundColor: (selected == 0) ? 'primary.700' : 'transparent',
                        }}
                    >
                        <Typography
                        level="body4"
                    >
                        CREATE A NEW ENTRY WITH THE FOLLOWING FIELDS:
                    </Typography>
                        <Stack
                            direction="row"
                            justifyContent='space-between'
                        >
                        {Object.keys(fieldStrings).map((item, index) => (
                            (fieldStrings[item].length > 0) ? (
                            <Chip
                                key={item}
                            >
                                <Typography level="body2">
                                    {item}: {fieldStrings[item]}
                                </Typography>
                            </Chip>) : (<div></div>)
                        ))}
                        </Stack>
                    </Box>
                )}
                <>
                <Divider />
                <Box
                    sx = {{
                        p: 1,
                        backgroundColor: (selected == 1) ? 'primary.700' : 'transparent',
                    }}
                >
                        <Typography
                        level="body4"
                    >
                        FROM YOUR MAIL BIN
                    </Typography>
                </Box>
                </>
                <Divider />
                <Stack
                    direction="row"
                    justifyContent="flex-end"
                    alignItems="center"
                    spacing={0.25}
                    sx = {{
                        position: 'absolute',
                        bottom: 0,
                        left: 0,
                        right: 0,
                        height: '40px',
                        p: 1,
                        '& > *': {
                            lineHeight: '0.5rem !important',
                        }
                    }}
                >
                    <Chip
                        variant="soft"
                        size="sm"
                        color="neutral"
                    >
                        <Typography level="body5">
                            TAB
                        </Typography>
                    </Chip>
                    <Typography
                            level="body4"
                    >
                    switches search fields
                    </Typography>
                    <Chip
                        variant="soft"
                        size="sm"
                        color="neutral"
                    >
                        <Typography level="body5">
                            SHIFT + TAB
                        </Typography>
                    </Chip>
                    <Typography
                            level="body4"
                    >
                    goes back a field
                    </Typography>
                    <Chip
                        variant="soft"
                        size="sm"
                        color="neutral"
                    >
                        <Typography level="body5">
                            UP ARROW
                        </Typography>
                    </Chip>
                    <Typography
                            level="body4"
                    >
                    selects the previous entry
                    </Typography>
                    <Chip
                        variant="soft"
                        size="sm"
                        color="neutral"
                    >
                        <Typography level="body5">
                            DOWN ARROW
                        </Typography>
                    </Chip>
                    <Typography
                            level = "body4"
                    >
                    selects the next entry
                    </Typography>
                    <Chip
                        variant="soft"
                        size="sm"
                        color="neutral"
                    >
                        <Typography level="body5">
                            ENTER
                        </Typography>
                    </Chip>
                    <Typography
                            level = "body4"
                    >
                    adds the result to the queue
                    </Typography>
                    <Chip
                        variant="soft"
                        size="sm"
                        color="neutral"
                    >
                        <Typography level="body5">
                            SHIFT +
                            ENTER
                        </Typography>
                    </Chip>
                    <Typography
                            level = "body4"
                    >
                    sets the current result playing
                    </Typography>
                </Stack>
            </Box>
          </Sheet>)}
          <Input
            ref={searchRef}
            placeholder={(searching) ? `Enter ${searchType}` : "Press  /  to search or start typing"} 
            startDecorator={<TroubleshootIcon />}
            endDecorator={
                <IconButton
                    variant="outlined"
                    color="neutral"
                    onClick={() => {
                        const input = searchRef.current.querySelector('input');
                        input.value = '';
                        input.focus();
                    }}
                >
                    /
                </IconButton>
            }
            onFocus={handleSearchFocused}
            onBlur={closeSearch}
            value={searchstring}
            onChange={handleSearchChange}
            sx = {{
                zIndex: 2,
            }}
          />
    </FormControl>
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
                                    <Typography level="body4" sx={{ mb: -1 }}>ARTIST</Typography>
                                    <Typography sx = {{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{props.releaseArtist}</Typography>
                                </Stack>
                                <Stack direction="column" sx = {{ width: 'calc(25%)' }}>
                                    <Typography level="body4" sx={{ mb: -1 }}>ALBUM</Typography>
                                    <Typography sx = {{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{props.releaseAlbum}</Typography>
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

export default FlowSheetPage;