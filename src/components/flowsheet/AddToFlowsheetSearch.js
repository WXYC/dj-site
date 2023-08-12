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
import React, { useCallback, useContext, useEffect, useRef, useState } from "react";
import { ArtistAvatar } from "../../components/catalog/ArtistAvatar";
import { RotationAvatar } from "../../components/flowsheet/RotationAvatar";
import { useAuth } from "../../services/authentication/authentication-context";
import { useFlowsheet } from "../../services/flowsheet/flowsheet-context";
import { useLive } from "../../services/flowsheet/live-context";
import { ClickAwayListener } from "@mui/material";
import { BinContext } from "../../services/bin/bin-context";

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

    const { bin, findInBin } = useContext(BinContext);

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

    const [binResults, setBinResults] = useState([]);
    const [rotationResults, setRotationResults] = useState([]);
    const [catalogResults, setCatalogResults] = useState([]);

    const searchRef = useRef(null);
    const [searching, setSearching] = useState(false);
  
    const [selected, setSelected] = useState(0);
    
    const [song, setSong] = useState("");
    const [artist, setArtist] = useState("");
    const [album, setAlbum] = useState("");
    const [label, setLabel] = useState("");

    const [searchTimeout, setSearchTimeout] = useState(null);

    const submitResult = () => {

    };
  
    const closeSearch = useCallback(() => {
      setSearching(false);
      setSelected(0);
      setSong("");
      setArtist("");
      setAlbum("");
      setLabel("");
    }, []);
  
    const handleSearchFocused = useCallback((e) => {
      setSearching(true);
    }, []);

    useEffect(() => {

        setBinResults(() => {
          let matchBy = [];
          if (artist?.length > 0) matchBy.push("artist.name");
          if (album?.length > 0) matchBy.push("title");
          if (label?.length > 0) matchBy.push("label");
          return findInBin(`${artist} ${album} ${label}`, matchBy);
        });

    }, [artist, album, label]);

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
            {(binResults.length > 0) && (<>
              <Divider />
              <Box
                sx={{
                  p: 1,
                }}
              >
                <Typography level="body4">FROM YOUR MAIL BIN</Typography>
              </Box>
              <Stack direction="column">
                {binResults.map((binItem, index) => (
                <Stack
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
                    artist={binItem.artist}
                    format={binItem.format}
                    entry={binItem.release_number}
                  />
                  <Stack direction="column" sx={{ width: "calc(20%)" }}>
                    <Typography level="body4" sx={{ 
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
                    </Typography>
                  </Stack>
                  <Stack direction="column" sx={{ width: "calc(20%)" }}>
                    <Typography level="body4" sx={{ 
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
                    <Typography level="body4" sx={{ 
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
                    <Typography level="body4" sx={{ 
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
      <Box
        className = {`MuiInput-root MuiInput-variantOutlined MuiInput-colorNeutral MuiInput-sizeSm MuiInput-formControl css-lr3pbo-JoyInput-root ${!live && 'Joy-disabled'}`}
        ref={searchRef}
        sx = {{
          display: 'flex',
          justifyContent: 'space-between',
          flexDirection: 'row',
          zIndex: 2,
          '& input': {
            background: 'transparent !important',
            outline: 'none !important',
            border: 'none !important',
            fontFamily: 'inherit !important',
            minWidth: '0 !important',
            px: 1,
            flex: 1,
          },
        }}
        onFocus={handleSearchFocused}
      >
        <Box className="MuiInput-startDecorator css-7ikbr-JoyInput-startDecorator">
          <TroubleshootIcon />
        </Box>
        <input
          placeholder="Song"
          value={song}
          onChange={(e) => setSong(e.target.value)}
        />
        <Divider orientation="vertical" />
        <input
          placeholder="Artist"
          value={artist}
          onChange={(e) => setArtist(e.target.value)}
        />
        <Divider orientation="vertical" />
        <input
          placeholder="Album"
          value={album}
          onChange={(e) => setAlbum(e.target.value)}
        />
        <Divider orientation="vertical" />
        <input
          placeholder="Label"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
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