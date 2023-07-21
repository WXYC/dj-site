import {
  Divider,
  Sheet,
  Stack,
  Box,
  Typography,
  Button,
  IconButton,
  Tooltip,
} from "@mui/joy";
import React from "react";
import AddToFlowsheetSearch from "../../components/flowsheet/AddToFlowsheetSearch";
import DraggingPreview from "../../components/flowsheet/DraggingPreview";
import FlowsheetEntry from "../../components/flowsheet/FlowsheetEntry";
import { useFlowsheet } from "../../services/flowsheet/flowsheet-context";
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PlayDisabledIcon from '@mui/icons-material/PlayDisabled';
import { useLive } from "../../services/flowsheet/live-context";
import WifiTetheringIcon from '@mui/icons-material/WifiTethering';
import PortableWifiOffIcon from '@mui/icons-material/PortableWifiOff';
import { useAuth } from "../../services/authentication/authentication-context";

/**
 * @page
 * @category Flowsheet
 * @description The FlowsheetPage component is the wrapper for the flowsheet view.
 * It provides the add to flowsheet search bar and the flowsheet entries.
 * @returns {JSX.Element} The rendered FlowSheetPage component.
 */
  const FlowSheetPage = () => {

    const { live, setLive } = useLive();
    const { user } = useAuth();
    const { 
      queue, 
      entries,
      addToEntries, 
      queuePlaceholderIndex, 
      setQueuePlaceholderIndex,
      entryPlaceholderIndex,
      setEntryPlaceholderIndex,
      entryClientRect,
      autoPlay,
      setAutoPlay,
    } = useFlowsheet();

    const switchLive = () => {
      if (live) {
          setLive(false);
          addToEntries({
              message: `DJ ${user.djName} left at ${new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`,
          });
      } else {
          setLive(true);
          addToEntries({
              message: `DJ ${user.djName} joined at ${new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`,
          });
      }
  }

    // THIS IS WHERE THE PAGE RENDER BEGINS ---------------------------------------------
    return (
      <div>
        <DraggingPreview /> {/* Shows us the preview of the dragged entry */}
      {/* HEADER AREA */}
      <Box
    sx={{
      display: "flex",
      alignItems: "center",
      my: 1,
      gap: 1,
      flexWrap: "wrap",
      "& > *": {
        minWidth: "clamp(0px, (500px - 100%) * 999, 100%)",
        flexGrow: 1,
      },
    }}
  >
    <Typography level="h1">Flowsheet</Typography>
    <Box sx={{ flex: 999 }}></Box>
    <Tooltip title={`Autoplay is ${autoPlay ? 'On' : 'Off'}`} placement="top" size="sm" variant="outlined">
    <IconButton
      disabled={!live}
      variant="outlined"
      color={(autoPlay) ? "primary" : "neutral"}
      onClick={() => setAutoPlay(!autoPlay)}
    >
      {(autoPlay) ? <PlayArrowIcon /> : <PlayDisabledIcon />}
    </IconButton>
    </Tooltip>
    <Button
      variant={(live) ? "solid" : "outlined"}
      color={(live) ? "primary" : "neutral"}
      startDecorator={(live) ? <WifiTetheringIcon /> : <PortableWifiOffIcon />}
      onClick={switchLive}
    >
      {live ? "You Are On Air" : "You Are Off Air"}
    </Button>
  </Box>
      <AddToFlowsheetSearch />
        {/* FLOWSHEET AREA */}
        <Sheet
          sx={{
            maxHeight: "calc(100vh - 200px)",
            overflowY: "auto",
            background: "transparent",
            mt: 2,
          }}
        >
            <Stack direction="column" spacing={1}>
            {queue.map((entry, index) => {
                if (entry.message.length > 0) return null;
              return (index == queuePlaceholderIndex) ? 
               (
                <FlowsheetEntry
                  key={`queue-${index}`}
                  type={"placeholder"}
                />
               )
               : (
                <FlowsheetEntry
                  index = {index}
                  key={`queue-${index}`}
                  type={"queue"}
                  {...entry}
                />
                );
            })}
            </Stack>
        <Divider sx = {{ my: 1 }} />
          <Stack direction="column" spacing={1}>
            {entries.map((entry, index) => {
              return (index == entryPlaceholderIndex) ? 
              (
                <FlowsheetEntry
                  key={`entry-${index}`}
                  type={"placeholder"}
                />
              )
              : (
                <FlowsheetEntry
                  index = {index}
                  key={`entry-${index}`}
                  type={
                    entry?.message?.length > 0
                      ? entry?.message?.includes("joined")
                        ? "joined"
                        : entry?.message?.includes("left")
                        ? "left"
                        : entry?.message?.includes("Breakpoint")
                        ? "breakpoint"
                        : entry?.message?.includes("Talkset")
                        ? "talkset"
                        : "error"
                      : "entry"
                  }
                  current={index === 0}
                  {...entry}
                />
              );
            })}
          </Stack>
        </Sheet>
      </div>
    );
  };
  
  export default FlowSheetPage;
  