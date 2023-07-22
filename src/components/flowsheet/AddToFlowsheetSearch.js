import MicIcon from "@mui/icons-material/Mic";
import TimerIcon from "@mui/icons-material/Timer";
import TroubleshootIcon from "@mui/icons-material/Troubleshoot";
import {
  Box,
  Chip,
  Divider,
  FormControl,
  IconButton,
  Input,
  Sheet,
  Stack,
  Tooltip,
  Typography
} from "@mui/joy";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { ArtistAvatar } from "../../components/catalog/ArtistAvatar";
import { RotationAvatar } from "../../components/flowsheet/RotationAvatar";
import { useAuth } from "../../services/authentication/authentication-context";
import { useFlowsheet } from "../../services/flowsheet/flowsheet-context";
import { useLive } from "../../services/flowsheet/live-context";
  
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

    const { live, setLive } = useLive();
    const { user } = useAuth();
    const { queue, addToQueue, entries, addToEntries } = useFlowsheet();

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

    const [searchResults, setSearchResults] = useState({}); // [{title, artist, album, label, id}

    const searchRef = useRef(null);
    const [searching, setSearching] = useState(false);
  
    const [searchstring, setSearchstring] = useState("");
    const [selected, setSelected] = useState(0);
    const [searchType, setSearchType] = useState("title"); // ['title', 'artist', 'album', 'label']
    const [fieldStrings, setFieldStrings] = useState({
      title: "",
      artist: "",
      album: "",
      label: "",
      
    });

    const [submitting, setSubmitting] = useState(false);
    const [asEntry, setAsEntry] = useState(false);
    const submitResult = (asEntry = false) => {
      setSubmitting(true);
      setAsEntry(asEntry);
    }

    useEffect(() => {
      if (!submitting) return;

      let selectedResult = searchResults[selected];
      var newEntry = (selected > 0)
        ? {
            message: "",
            ...selectedResult,
            request: false,
          }
        : {
            message: "",
            ...fieldStrings,
            request: false,
          };

      (asEntry) ? addToEntries(newEntry) : addToQueue(newEntry);
      
      // Now clear everything
      closeSearch();
      setSelected(0);
      const input = searchRef.current.querySelector("input");
      input.blur();
      setFieldStrings({
        title: "",
        artist: "",
        album: "",
        label: "",
        
      });
      setSubmitting(false);
      setAsEntry(false);
    }, [submitting]);
  
    const handleSearchDown = useCallback((e) => {
    if (!live) return;
      if (e.key === "/") {
        e.preventDefault();
        // get input child from searchRef
        const input = searchRef.current.querySelector("input");
        input.focus();
      }
      if (searchRef.current.querySelector("input") === document.activeElement) {
        if (e.key === "Escape") {
          e.preventDefault();
          e.target.blur();
        } else if (e.key === "Tab") {
          e.preventDefault();
          let newSearchMap = null;
          if (e.shiftKey) {
            newSearchMap = {
              title: "label",
              artist: "title",
              album: "artist",
              label: "album",
            };
          } else {
            newSearchMap = {
              title: "artist",
              artist: "album",
              album: "label",
              label: "title",
            };
          }
          setSearchstring("");
          setSearchType((previous) => newSearchMap[previous]);
        } else if (e.keyCode === 38) {
          e.preventDefault();
          setSelected((previous) => Math.max(0, previous - 1));
        } else if (e.keyCode === 40) {
          e.preventDefault();
          setSelected((previous) =>
            Math.min((searchResults?.length ?? 1) - 1, previous + 1)
          );
        } else if (e.key === "Enter") {
          e.preventDefault();
          submitResult(e.shiftKey);
        }
      }
    }, [live, searchResults, submitResult]);
  
    const closeSearch = useCallback(() => {
      setSearching(false);
      setSearchstring("");
      setSelected(0);
      setSearchType("title");
      setFieldStrings({
        title: "",
        artist: "",
        album: "",
        label: "",
        
      });
    }, []);
  
    const handleSearchFocused = useCallback((e) => {
      setSearching(true);
    }, []);
  
    const handleSearchChange = useCallback((e) => {
      setSearchstring(e.target.value);
      setFieldStrings((prevFieldStrings) => ({
        ...prevFieldStrings,
        [searchType]: e.target.value,
      }));
    }, [searchType]);
  
    useEffect(() => {
    document.removeEventListener("keydown", handleSearchDown);
      document.addEventListener("keydown", handleSearchDown);
      return () => {
        document.removeEventListener("keydown", handleSearchDown);
      };
    }, [live]);

return (
    <>
  {/* SEARCH AREA */}
  <Stack direction="row" spacing={1}>
    <FormControl size="sm" sx={{ flex: 1 }}>
      {searching && (
        <Sheet
          variant="outlined"
          sx={{
            minHeight: "60px",
            position: "absolute",
            top: -5,
            left: -5,
            right: -5,
            zIndex: 1,
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
            {searchstring.length +
              Object.keys(fieldStrings).reduce((total, item) => {
                return total + fieldStrings[item].length;
              }, 0) >
              0 && (
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
                <Typography level="body4">
                  CREATE A NEW ENTRY WITH THE FOLLOWING FIELDS:
                </Typography>
                <Stack direction="row" justifyContent="space-between" flexWrap="wrap">
                  {Object.keys(fieldStrings).map((item, index) =>
                    fieldStrings[item].length > 0 ? (
                      <Chip key={item}
                        sx={{ my: 0.5 }}
                      >
                        <Typography key={`${item}-label`} level="body2" textColor={'text.primary'}>
                          {item}: {fieldStrings[item]}
                        </Typography>
                      </Chip>
                    ) : (
                      <div></div>
                    )
                  )}
                </Stack>
              </Box>
            )}
            {(searchResults["bin"]) && (<>
              <Divider />
              <Box
                sx={{
                  p: 1,
                }}
              >
                <Typography level="body4">FROM YOUR MAIL BIN</Typography>
              </Box>
              <Stack direction="column">
                <Stack
                  direction="row"
                  justifyContent="space-between"
                  sx={{
                    p: 1,
                    backgroundColor:
                      selected == 1 ? "primary.700" : "transparent",
                    cursor: "pointer",
                  }}
                  onMouseOver={() => setSelected(1)}
                  onClick={submitResult}
                >
                  <ArtistAvatar
                    artist={{
                      genre: "Rock",
                      lettercode: "AB",
                      numbercode: "128",
                      entry: "1",
                    }}
                  />
                  <Stack direction="column" sx={{ width: "calc(20%)" }}>
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
                      {fieldStrings["title"]}
                    </Typography>
                  </Stack>
                  <Stack direction="column" sx={{ width: "calc(20%)" }}>
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
                      Album Name
                    </Typography>
                  </Stack>
                  <Stack direction="column" sx={{ width: "calc(20%)" }}>
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
                      Artist Name
                    </Typography>
                  </Stack>
                  <Stack direction="column" sx={{ width: "calc(20%)" }}>
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
                      Label Name
                    </Typography>
                  </Stack>
                </Stack>
              </Stack>
            </>)}
            {(searchResults["rotation"]) && (<>
              <Divider />
              <Box
                sx={{
                  p: 1,
                }}
              >
                <Typography level="body4">ROTATION</Typography>
              </Box>
              <Stack direction="column">
                <Stack
                  direction="row"
                  justifyContent="space-between"
                  sx={{
                    p: 1,
                    backgroundColor:
                      selected == 2 ? "primary.700" : "transparent",
                    cursor: "pointer",
                  }}
                  onMouseOver={() => setSelected(2)}
                  onClick={submitResult}
                >
                  <RotationAvatar rotation="M" />
                  <Stack direction="column" sx={{ width: "calc(20%)" }}>
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
                      {fieldStrings["title"]}
                    </Typography>
                  </Stack>
                  <Stack direction="column" sx={{ width: "calc(20%)" }}>
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
                      Album Name
                    </Typography>
                  </Stack>
                  <Stack direction="column" sx={{ width: "calc(20%)" }}>
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
                      Artist Name
                    </Typography>
                  </Stack>
                  <Stack direction="column" sx={{ width: "calc(20%)" }}>
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
                      Label Name
                    </Typography>
                  </Stack>
                </Stack>
              </Stack>

              <Stack direction="column">
                <Stack
                  direction="row"
                  justifyContent="space-between"
                  sx={{
                    p: 1,
                    backgroundColor:
                      selected == 3 ? "primary.700" : "transparent",
                    cursor: "pointer",
                  }}
                  onMouseOver={() => setSelected(3)}
                  onClick={submitResult}
                >
                  <RotationAvatar rotation="H" />
                  <Stack direction="column" sx={{ width: "calc(20%)" }}>
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
                      {fieldStrings["title"]}
                    </Typography>
                  </Stack>
                  <Stack direction="column" sx={{ width: "calc(20%)" }}>
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
                      Album Name
                    </Typography>
                  </Stack>
                  <Stack direction="column" sx={{ width: "calc(20%)" }}>
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
                      Artist Name
                    </Typography>
                  </Stack>
                  <Stack direction="column" sx={{ width: "calc(20%)" }}>
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
                      Label Name
                    </Typography>
                  </Stack>
                </Stack>
              </Stack>
            </>)}
            {(searchResults["catalog"]) && (<>
              <Divider />
              <Box
                sx={{
                  p: 1,
                }}
              >
                <Typography level="body4">CATALOG</Typography>
              </Box>
              <Stack direction="column">
                <Stack
                  direction="row"
                  justifyContent="space-between"
                  sx={{
                    p: 1,
                    backgroundColor:
                      selected == 4 ? "primary.700" : "transparent",
                    cursor: "pointer",
                  }}
                  onMouseOver={() => setSelected(4)}
                  onClick={submitResult}
                >
                  <ArtistAvatar
                    artist={{
                      genre: "Hiphop",
                      lettercode: "AB",
                      numbercode: "128",
                      entry: "1",
                    }}
                  />
                  <Stack direction="column" sx={{ width: "calc(20%)" }}>
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
                      {fieldStrings["title"]}
                    </Typography>
                  </Stack>
                  <Stack direction="column" sx={{ width: "calc(20%)" }}>
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
                      Album Name
                    </Typography>
                  </Stack>
                  <Stack direction="column" sx={{ width: "calc(20%)" }}>
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
                      Artist Name
                    </Typography>
                  </Stack>
                  <Stack direction="column" sx={{ width: "calc(20%)" }}>
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
                      Label Name
                    </Typography>
                  </Stack>
                </Stack>
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
                <Typography level="body5">TAB</Typography>
              </Chip>
              <Typography level="body4">switches search fields</Typography>
              <Chip variant="soft" size="sm" color="neutral">
                <Typography level="body5">SHIFT + TAB</Typography>
              </Chip>
              <Typography level="body4">goes back a field</Typography>
              <Chip variant="soft" size="sm" color="neutral">
                <Typography level="body5">UP ARROW</Typography>
              </Chip>
              <Typography level="body4">
                selects the previous entry
              </Typography>
              <Chip variant="soft" size="sm" color="neutral">
                <Typography level="body5">DOWN ARROW</Typography>
              </Chip>
              <Typography level="body4">selects the next entry</Typography>
              <Chip variant="soft" size="sm" color="neutral">
                <Typography level="body5">ENTER</Typography>
              </Chip>
              <Typography level="body4">
                adds the result to the queue
              </Typography>
              <Chip variant="soft" size="sm" color="neutral">
                <Typography level="body5">SHIFT + ENTER</Typography>
              </Chip>
              <Typography level="body4">
                sets the current result playing
              </Typography>
            </Stack>
          </Box>
        </Sheet>
      )}
      <Input
          disabled={!live}
        ref={searchRef}
        placeholder={
          searching
            ? (searchType != "title") ? `Enter ${searchType}` : "Start by providing a song title"
            : "Press  /  to search or start typing in this box"
        }
        startDecorator={<TroubleshootIcon />}
        endDecorator={
          <>
          <IconButton
            variant="outlined"
            color="neutral"
            onClick={() => {
              const input = searchRef.current.querySelector("input");
              input.value = "";
              input.focus();
            }}
          >
            /
          </IconButton>
          </>
        }
        onFocus={handleSearchFocused}
        onBlur={closeSearch}
        value={searchstring}
        onChange={handleSearchChange}
        sx={{
          zIndex: 2,
        }}
      />
    </FormControl>
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