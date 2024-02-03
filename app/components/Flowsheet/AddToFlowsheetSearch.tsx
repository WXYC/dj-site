'use client';
import { CatalogResult, FlowSheetEntry, flowSheetSlice, isLive, useDispatch, useSelector } from "@/lib/redux";
import MicIcon from "@mui/icons-material/Mic";
import TimerIcon from "@mui/icons-material/Timer";
import TroubleshootIcon from "@mui/icons-material/Troubleshoot";
import {
    Box,
    BoxSlot,
    Button,
    Chip,
    Divider,
    FormControl,
    IconButton,
    Sheet,
    Stack,
    Tooltip,
    Typography
} from "@mui/joy";
import { ClickAwayListener } from "@mui/material";
import { createRef, useCallback, useContext, useEffect, useRef, useState } from "react";
import { findInBin } from "../Bin/local-search";
import { findInRotation } from "../Catalog/search/local-search";
import { getReleasesMatching } from "../../services/card-catalog/card-catalog-service";
import { ArtistAvatar } from "../Catalog/ArtistAvatar";

/**
 * @component
 * @category Flowsheet
 * @description Add to flowsheet search component.
 * Adds event listeners to the search input and handles the search results.
 * Receives all data from and posts all data to Flowsheet Context to be handled asynchronusly.
 * @param {Object} props
 * @returns JSX.Element
 */
const AddToFlowsheetSearch = () => {

    const dispatch = useDispatch();

    const live = useSelector(isLive);

    const addToQueue = (item: FlowSheetEntry) => dispatch(flowSheetSlice.actions.addToQueue(item));
    const addToEntries = (item: FlowSheetEntry) => dispatch(flowSheetSlice.actions.addToEntries(item));

    const addTalkset = () => {
        addToEntries({
            message: "Talkset",
        });
    }

    const addBreakpoint = () => {
        const nextHour = new Date();
        nextHour.setHours(nextHour.getHours() + 1);
        nextHour.setMinutes(0);
        nextHour.setSeconds(0);
        addToEntries({
            message: `${nextHour.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} Breakpoint`,
        });
    }

    const [binResults, setBinResults] = useState<CatalogResult[]>([]);
    const [rotationResults, setRotationResults] = useState([]);
    const [catalogResults, setCatalogResults] = useState([]);

    const searchRef = useRef<HTMLInputElement | null>();
    const [searching, setSearching] = useState(false);
  
    const [selected, setSelected] = useState(0);
    
    const [song, setSong] = useState("");
    const [artist, setArtist] = useState("");
    const [album, setAlbum] = useState("");
    const [label, setLabel] = useState("");

    const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout | null>(null);
    useEffect(() => {

      if (searching && ((artist.length + album.length + label.length) > Math.max(artist.length, album.length, label.length))) {
        if (searchTimeout) clearTimeout(searchTimeout);
        setSearchTimeout(setTimeout(() => {
          getReleasesMatching(`${artist} ${album} ${label}`, 'All', 'All', 4).then((results) => {
            setCatalogResults(results);
          });
        }, 1000));
      } else {
        setCatalogResults([]);
      }

      return () => {
        if (searchTimeout) clearTimeout(searchTimeout);
      }
    }, [artist, album, label, searching]);

    const submitResult = useCallback((e: any) => {
      e.preventDefault();
    
      let submission: FlowSheetEntry = {
        message: "",
        song: {
            title: song,
            album: (() => {
                if (selected > 0 && selected <= binResults.length) {
                    return binResults[selected - 1].album;
                }
                if (selected > binResults.length && selected <= binResults.length + rotationResults.length) {
                    return rotationResults[selected - binResults.length - 1];
                }
                if (selected > binResults.length + rotationResults.length && selected <= binResults.length + rotationResults.length + catalogResults.length) {
                    return catalogResults[selected - binResults.length - rotationResults.length - 1];
                }
            })()
        }
      }

      if (e.shiftKey) {
        addToEntries(submission);
      } else {
        addToQueue(submission);
      }
      
      closeSearch();

    }, [selected, binResults, rotationResults, catalogResults, song, artist, album, label]);
  
    const closeSearch = () => {
        setBinResults([]);
        setRotationResults([]);
        setCatalogResults([]);
        setSearching(false);
        setSelected(0);
        setSong("");
        setArtist("");
        setAlbum("");
        setLabel("");
        if (searchRef.current) {
            searchRef.current.blur();
            searchRef.current.querySelectorAll("input").forEach((input) => {
                input.blur();
            });
        }
    };
  
    const handleSearchFocused = useCallback((e: any) => {
      setSearching(true);
    }, []);

    useEffect(() => {
        setRotationResults(findInRotation(`${artist} ${album} ${label}`));
        setBinResults(findInBin(`${artist} ${album} ${label}`));

    }, [artist, album, label]); 
    
    const handleKeyDown = useCallback(
      (e: any) => {
        if (!live) return;
        if (e.key === "ArrowUp") {
          e.preventDefault();
          setSelected((prev) => (prev > 0 ? prev - 1 : 0));
        }
        if (e.key === "ArrowDown") {
          e.preventDefault();
          let max = binResults.length + rotationResults.length + catalogResults.length;
          setSelected((prev) => (prev < max ? prev + 1 : max));
        }
        if (e.key === "/") {
          e.preventDefault();
          searchRef?.current?.querySelector("input")?.focus();
        }
        if (!searching) return;
        if (e.key === "Escape") {
          closeSearch();
        }
        if (e.key === "Enter") {
          e.preventDefault();
          submitResult(e);
        }
      },
      [live, binResults, rotationResults, catalogResults, searching, submitResult]
    );

    useEffect(() => {
      document.removeEventListener("keydown", handleKeyDown);
      document.addEventListener("keydown", handleKeyDown);

      return () => {
        document.removeEventListener("keydown", handleKeyDown);
      };
    }, [handleKeyDown]);

return (
    <>
  {/* SEARCH AREA */}
  <Stack direction="row" spacing={1}>
  <ClickAwayListener
        onClickAway={closeSearch}
      >
    <FormControl size="sm" sx={{ flex: 1, minWidth: 0 }}>
      {searching && (
        <Sheet
          variant="outlined"
          sx={{
            minHeight: "60px",
            position: "absolute",
            top: -5,
            left: -5,
            right: -5,
            zIndex: 8000,
            borderRadius: "md",
            transition: "height 0.2s ease-in-out",
            boxShadow: "0px 34px 24px -9px rgba(0,0,0,0.5)",
          }}
        >
          <Box
            sx={{
              mt: "40px",
              position: "relative",
              minHeight: "40px",
              pb: "40px",
              transition: "height 0.2s ease-in-out",
            }}
          >
            {(song.length + artist.length + album.length + label.length > 0) && (
              <Box
                sx={{
                  p: 1,
                  backgroundColor:
                    selected == 0 ? "primary.700" : "transparent",
                  cursor: "pointer",
                }}
                onMouseOver={() => setSelected(0)}
                onClick={submitResult}
              >
                <Typography level="body-md"
                  sx = {{ color: selected == (0) ? "neutral.200" : "inherit"}}
                >
                  CREATE A NEW ENTRY WITH THE FOLLOWING FIELDS:
                </Typography>
                <Stack direction="row" justifyContent="space-between" flexWrap="wrap">
                {(song.length > 0) ? (
                      <Chip
                        sx={{ my: 0.5 }}
                      >
                        <Typography level="body-lg" textColor={'text.primary'}>
                          Song: {song}
                        </Typography>
                      </Chip>
                    ) : ( <div></div> )}
                    {(artist.length > 0) ? (
                      <Chip
                        sx={{ my: 0.5 }}
                      >
                        <Typography level="body-lg" textColor={'text.primary'}>
                          Artist: {artist}
                        </Typography>
                      </Chip>
                    ) : ( <div></div> )}
                    {(album.length > 0) ? (
                      <Chip
                        sx={{ my: 0.5 }}
                      >
                        <Typography level="body-lg" textColor={'text.primary'}>
                          Album: {album}
                        </Typography>
                      </Chip>
                    ) : ( <div></div> )}
                    {(label.length > 0) ? (
                      <Chip
                        sx={{ my: 0.5 }}
                      >
                        <Typography level="body-lg" textColor={'text.primary'}>
                          Label: {label}
                        </Typography>
                      </Chip>
                    ) : ( <div></div> )}
                </Stack>
              </Box>
            )}
            {(binResults.length > 0) && (<>
              <Divider />
              <Box
                sx={{
                  p: 1,
                }}
              >
                <Typography level="body-md">FROM YOUR MAIL BIN</Typography>
              </Box>
              <Stack direction="column">
                {binResults.map((binItem, index) => (
                <Stack
                  key={`bin-${index}`}
                  direction="row"
                  justifyContent="space-between"
                  sx={{
                    p: 1,
                    backgroundColor:
                      selected == (1 + index) ? "primary.700" : "transparent",
                    cursor: "pointer",
                  }}
                  onMouseOver={() => setSelected(1 + index)}
                  onClick={submitResult}
                >
                  <ArtistAvatar
                    artist={binItem.album.artist}
                    format={binItem.album.format}
                    entry={binItem.album.release}
                  />
                  <Stack direction="column" sx={{ width: "calc(20%)" }}>
                    <Typography level="body-md" sx={{ 
                      mb: -1,
                      color: selected == (1 + index) ? "neutral.200" : "inherit",
                    }}>
                      CODE
                    </Typography>
                    <Typography
                      sx={{
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        color: selected == (1 + index) ? "white" : "inherit",
                      }}
                    >
                      {binItem.artist.genre} {binItem.artist.lettercode} {binItem.artist.numbercode}/{binItem.release_number}
                      <Chip
                        variant="soft"
                        size="sm"
                        color={
                          {
                            cd: 'primary',
                            vinyl: 'warning',
                          }[binItem.format.includes('vinyl') ? 'vinyl' : 'cd']
                        }
                        sx = {{
                          ml: 2,
                        }}
                      >
                        {binItem.format.includes('vinyl') ? 'vinyl' : 'cd'}
                      </Chip>
                    </Typography>
                  </Stack>
                  <Stack direction="column" sx={{ width: "calc(20%)" }}>
                    <Typography level="body-md" sx={{ 
                      mb: -1,
                      color: selected == (1 + index) ? "neutral.200" : "inherit",
                    }}>
                      ARTIST
                    </Typography>
                    <Typography
                      sx={{
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        color: selected == (1 + index) ? "white" : "inherit",
                      }}
                    >
                      {binItem.artist.name}
                    </Typography>
                  </Stack>
                  <Stack direction="column" sx={{ width: "calc(20%)" }}>
                    <Typography level="body-md" sx={{ 
                      mb: -1,
                      color: selected == (1 + index) ? "neutral.200" : "inherit",
                    }}>
                      ALBUM
                    </Typography>
                    <Typography
                      sx={{
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        color: selected == (1 + index) ? "white" : "inherit",
                      }}
                    >
                      {binItem.title}
                    </Typography>
                  </Stack>
                  <Stack direction="column" sx={{ width: "calc(20%)" }}>
                    <Typography level="body-md" sx={{ 
                      mb: -1,
                      color: selected == (1 + index) ? "neutral.200" : "inherit",
                    }}>
                      LABEL
                    </Typography>
                    <Typography
                      sx={{
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        color: selected == (1 + index) ? "white" : "inherit",
                      }}
                    >
                      {binItem.label}
                    </Typography>
                  </Stack>
                </Stack>))}
              </Stack>
            </>)}
            {(rotationResults.length > 0) && (<>
              <Divider />
              <Box
                sx={{
                  p: 1,
                }}
              >
                <Typography level="body-md">FROM ROTATION</Typography>
              </Box>
              <Stack direction="column">
                {rotationResults.map((rotationItem, index) => (
                <Stack
                  key={`rotation-${index}`}
                  direction="row"
                  justifyContent="space-between"
                  sx={{
                    p: 1,
                    backgroundColor:
                      selected == (1 + binResults.length + index) ? "primary.700" : "transparent",
                    cursor: "pointer",
                  }}
                  onMouseOver={() => setSelected(1 + binResults.length + index)}
                  onClick={submitResult}
                >
                  <ArtistAvatar
                    artist={rotationItem.artist}
                    format={rotationItem.format}
                    entry={rotationItem.release_number}
                    play_freq={rotationItem.play_freq}
                  />
                  <Stack direction="column" sx={{ width: "calc(20%)" }}>
                    <Typography level="body-md" sx={{ 
                      mb: -1,
                      color: selected == (1 + binResults.length + index) ? "neutral.200" : "inherit",
                    }}>
                      CODE
                    </Typography>
                    <Typography
                      sx={{
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        color: selected == (1 + binResults.length + index) ? "white" : "inherit",
                      }}
                    >
                      {rotationItem.artist.genre} {rotationItem.artist.lettercode} {rotationItem.artist.numbercode}/{rotationItem.release_number}
                      <Chip
                        variant="soft"
                        size="sm"
                        color={
                          {
                            cd: 'primary',
                            vinyl: 'warning',
                          }[rotationItem.format.includes('vinyl') ? 'vinyl' : 'cd']
                        }
                        sx = {{
                          ml: 2,
                        }}
                      >
                        {rotationItem.format.includes('vinyl') ? 'vinyl' : 'cd'}
                      </Chip>
                    </Typography>
                  </Stack>
                  <Stack direction="column" sx={{ width: "calc(20%)" }}>
                    <Typography level="body-md" sx={{ 
                      mb: -1,
                      color: selected == (1 + binResults.length + index) ? "neutral.200" : "inherit",
                    }}>
                      ARTIST
                    </Typography>
                    <Typography
                      sx={{
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        color: selected == (1 + binResults.length + index) ? "white" : "inherit",
                      }}
                    >
                      {rotationItem.artist.name}
                    </Typography>
                  </Stack>
                  <Stack direction="column" sx={{ width: "calc(20%)" }}>
                    <Typography level="body-md" sx={{ 
                      mb: -1,
                      color: selected == (1 + binResults.length + index) ? "neutral.200" : "inherit",
                    }}>
                      ALBUM
                    </Typography>
                    <Typography
                      sx={{
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        color: selected == (1 + binResults.length + index) ? "white" : "inherit",
                      }}
                    >
                      {rotationItem.title}
                    </Typography>
                  </Stack>
                  <Stack direction="column" sx={{ width: "calc(20%)" }}>
                    <Typography level="body-md" sx={{ 
                      mb: -1,
                      color: selected == (1 + binResults.length + index) ? "neutral.200" : "inherit",
                    }}>
                      LABEL
                    </Typography>
                    <Typography
                      sx={{
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        color: selected == (1 + binResults.length + index) ? "white" : "inherit",
                      }}
                    >
                      {rotationItem.label}
                    </Typography>
                  </Stack>
                </Stack>))}
              </Stack>
            </>)}
            {(catalogResults.length > 0) && (<>
              <Divider />
              <Box
                sx={{
                  p: 1,
                }}
              >
                <Typography level="body-md">CATALOG</Typography>
              </Box>
              <Stack direction="column">
                {catalogResults.map((catalogItem, index) => (
                <Stack
                  key={`catalog-${index}`}
                  direction="row"
                  justifyContent="space-between"
                  sx={{
                    p: 1,
                    backgroundColor:
                      selected == (1 + binResults.length + rotationResults.length + index) ? "primary.700" : "transparent",
                    cursor: "pointer",
                  }}
                  onMouseOver={() => setSelected(1 + binResults.length + rotationResults.length + index)}
                  onClick={submitResult}
                >
                  <ArtistAvatar
                    artist={catalogItem.artist}
                    format={catalogItem.format}
                    entry={catalogItem.release_number}
                  />
                  <Stack direction="column" sx={{ width: "calc(20%)" }}>
                    <Typography level="body-md" 
                      sx={{
                        mb: -1,
                        color: selected == (1 + binResults.length + rotationResults.length + index) ? "neutral.200" : "inherit",
                      }}
                    >
                      CODE
                    </Typography>
                    <Typography
                      sx={{
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        color: selected == (1 + binResults.length + rotationResults.length + index) ? "white" : "inherit",
                      }}
                    >
                      {catalogItem.artist.genre} {catalogItem.artist.lettercode} {catalogItem.artist.numbercode}/{catalogItem.release_number}
                      <Chip
                        variant="soft"
                        size="sm"
                        color={
                          {
                            cd: 'primary',
                            vinyl: 'warning',
                          }[catalogItem.format.includes('vinyl') ? 'vinyl' : 'cd']
                        }
                        sx = {{
                          ml: 2,
                        }}
                      >
                        {catalogItem.format.includes('vinyl') ? 'vinyl' : 'cd'}
                      </Chip>
                    </Typography>
                  </Stack>
                  <Stack direction="column" sx={{ width: "calc(20%)" }}>
                    <Typography level="body-md" 
                      sx={{
                        mb: -1,
                        color: selected == (1 + binResults.length + rotationResults.length + index) ? "neutral.200" : "inherit",
                      }}
                    >
                      ARTIST
                    </Typography>
                    <Typography
                      sx={{
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        color: selected == (1 + binResults.length + rotationResults.length + index) ? "white" : "inherit",
                      }}
                    >
                      {catalogItem.artist.name}
                    </Typography>
                  </Stack>
                  <Stack direction="column" sx={{ width: "calc(20%)" }}>
                    <Typography level="body-md" 
                      sx={{
                        mb: -1,
                        color: selected == (1 + binResults.length + rotationResults.length + index) ? "neutral.200" : "inherit",
                      }}
                    >
                      ALBUM
                    </Typography>
                    <Typography
                      sx={{
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        color: selected == (1 + binResults.length + rotationResults.length + index) ? "white" : "inherit",
                      }}
                    >
                      {catalogItem.title}
                    </Typography>
                  </Stack>
                  <Stack direction="column" sx={{ width: "calc(20%)" }}>
                    <Typography level="body-md" 
                      sx={{
                        mb: -1,
                        color: selected == (1 + binResults.length + rotationResults.length + index) ? "neutral.200" : "inherit",
                      }}
                    >
                      LABEL
                    </Typography>
                    <Typography
                      sx={{
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        color: selected == (1 + binResults.length + rotationResults.length + index) ? "white" : "inherit",
                      }}
                    >
                      {catalogItem.label}
                    </Typography>
                  </Stack>
                </Stack>
                ))}
              </Stack>
            </>)}
            <Divider />
            <Stack
              direction="row"
              justifyContent="flex-end"
              alignItems="center"
              spacing={0.25}
              sx={{
                position: "absolute",
                bottom: 0,
                left: 0,
                right: 0,
                height: "40px",
                p: 1,
                "& > *": {
                  lineHeight: "0.5rem !important",
                },
              }}
            >
              <Chip variant="soft" size="sm" color="neutral">
                <Typography level="body-sm">TAB</Typography>
              </Chip>
              <Typography level="body-md">switches search fields</Typography>
              <Chip variant="soft" size="sm" color="neutral">
                <Typography level="body-sm">SHIFT + TAB</Typography>
              </Chip>
              <Typography level="body-md">goes back a field</Typography>
              <Chip variant="soft" size="sm" color="neutral">
                <Typography level="body-sm">UP ARROW</Typography>
              </Chip>
              <Typography level="body-md">
                selects the previous entry
              </Typography>
              <Chip variant="soft" size="sm" color="neutral">
                <Typography level="body-sm">DOWN ARROW</Typography>
              </Chip>
              <Typography level="body-md">selects the next entry</Typography>
              <Chip variant="soft" size="sm" color="neutral">
                <Typography level="body-sm">ENTER</Typography>
              </Chip>
              <Typography level="body-md">
                adds the result to the queue
              </Typography>
              <Chip variant="soft" size="sm" color="neutral">
                <Typography level="body-sm">SHIFT + ENTER</Typography>
              </Chip>
              <Typography level="body-md">
                sets the current result playing
              </Typography>
            </Stack>
          </Box>
        </Sheet>
      )}
      <Box
        ref={searchRef}
        component="div"
        sx = {{
          display: 'flex',
          justifyContent: 'space-between',
          flexDirection: 'row',
          zIndex: 8001,
          background: 'var(--joy-palette-background-surface)',
          outline: '1px solid',
          outlineColor: 'var(--joy-palette-neutral-outlinedBorder, var(--joy-palette-neutral-200, #D8D8DF))',
          borderRadius: '8px',
          minHeight: 'var(--Input-minHeight)',
          paddingInline: '0.5rem',
          cursor: live ? 'text' : 'default',
          '& input': {
            background: 'transparent !important',
            outline: 'none !important',
            border: 'none !important',
            fontFamily: 'inherit !important',
            minWidth: '0 !important',
            px: 1,
            flex: 1,
            minHeight: '2rem',
            cursor: live ? 'text' : 'default',
          },
          '&:hover': {
            outlineColor: live ? 'var(--joy-palette-neutral-700)' : 'var(--joy-palette-neutral-outlinedBorder, var(--joy-palette-neutral-200, #D8D8DF))',
          },
          '&:focus-within': {
            outline: '2px solid',
            outlineColor: 'var(--joy-palette-primary-400, #02367D)',
          },
        }}
        onClick={() => live && searchRef.current.querySelector("input").focus()}
        onFocus={handleSearchFocused}
      >
        <Box
          sx = {{
            marginInlineEnd: '0.5rem',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: 'min(1.5rem, var(--Input-minHeight))',
            pointerEvents: 'none',
            '& svg': {
              fill: 'var(--joy-palette-neutral-400) !important',
              pointerEvents: 'none',
            },
          }}
        >
          <TroubleshootIcon />
        </Box>
        <input
          disabled={!live}
          placeholder="Song"
          value={song}
          onChange={(e) => setSong(e.target.value)}
          onClick={(e) => e.stopPropagation()}
        />
        <Divider orientation="vertical" />
        <input
          disabled={!live}
          placeholder="Artist"
          value={artist}
          onChange={(e) => setArtist(e.target.value)}
          onClick={(e) => e.stopPropagation()}
        />
        <Divider orientation="vertical" />
        <input
          disabled={!live}
          placeholder="Album"
          value={album}
          onChange={(e) => setAlbum(e.target.value)}
          onClick={(e) => e.stopPropagation()}
        />
        <Divider orientation="vertical" />
        <input
          disabled={!live}
          placeholder="Label"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onClick={(e) => e.stopPropagation()}
        />
        <Box
        component="div"
          className="MuiInput-endDecorator css-x3cgwv-JoyInput-endDecorator"
          sx = {{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            mr: -0.5,
          }}
          >
          <Button
            size="sm"
            variant="outlined"
            color="neutral"
            disabled={!live}
            onClick={() => {
              const input = searchRef.current.querySelector("input");
              input.value = "";
              input.focus();
            }}
            sx = {{
              minHeight: '22px',
              maxWidth: '22px !important',
              borderRadius: '0.3rem',
              '& > button': {
                maxWidth: '12px !important',
              }
            }}
          >
            /
          </Button>
          </Box>
      </Box>
    </FormControl>
    </ClickAwayListener>
    <Tooltip
      placement="top"
      size="sm"
      title="Add a Breakpoint"
      variant="outlined"
    >
      <IconButton size="sm" variant="solid" color="warning" onClick={addBreakpoint} disabled={!live}>
        <TimerIcon />
      </IconButton>
    </Tooltip>
    <Tooltip
      placement="top"
      size="sm"
      title="Add a Talkset"
      variant="outlined"
    >
      <IconButton size="sm" variant="solid" color="success" onClick={addTalkset} disabled={!live}>
        <MicIcon />
      </IconButton>
    </Tooltip>
  </Stack>
  </>
);
}

export default AddToFlowsheetSearch;