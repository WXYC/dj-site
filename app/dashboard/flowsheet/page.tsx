'use client';
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
import React, { useCallback, useEffect } from "react";
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
import { flowSheetSlice, isLive, processingLive, useDispatch, useSelector, join, authenticationSlice, getAuthenticatedUser, leave, getQueue, getFlowSheet, getEntries, getEntryPlaceholderIndex, getQueuePlaceholderIndex, getAutoplay } from "@/lib/redux";

/**
 * @page
 * @category Flowsheet
 * @description The FlowsheetPage component is the wrapper for the flowsheet view.
 * It provides the add to flowsheet search bar and the flowsheet entries.
 * @returns {JSX.Element} The rendered FlowSheetPage component.
 */
  const FlowSheetPage = () => {
    
    const dispatch = useDispatch();

    const user = useSelector(getAuthenticatedUser);

    const live = useSelector(isLive);
    const intermediate = useSelector(processingLive);
    const goLive = useCallback(() => {

      if (!user?.djId) {
        return;
      }

      dispatch(join({
        dj_id: user?.djId,
      }));

    }, [user?.djId]);

    const goOff = useCallback(() => {

      if (!user?.djId) {
        return;
      }

      dispatch(leave({
        dj_id: user?.djId,
      }));

    }, [user?.djId]);

    const queue = useSelector(getQueue);
    const entries = useSelector(getEntries);
    const addToEntries = (entry: FlowsheetEntry) => dispatch(flowSheetSlice.actions.addToEntries(entry));
    const queuePlaceholderIndex = useSelector(getQueuePlaceholderIndex);
    const entryPlaceholderIndex = useSelector(getEntryPlaceholderIndex);
    const autoPlay = useSelector(getAutoplay);
    const setAutoPlay = (autoPlay: boolean) => dispatch(flowSheetSlice.actions.setAutoPlay(autoPlay));



    const switchLive = () => {
      (live) ? goOff() : goLive();

      addToEntries({
        message: `DJ ${user?.djName ?? "You"} ${(live) ? 'left' : 'joined'} the set!`,
        title: "",
        artist: "",
        album: "",
        label: "",
        request: false,
      });
    };

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
      disabled={intermediate}
      loading={intermediate}
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
            overflowX: 'visible',
          }}
        >
            <Stack direction="column" spacing={1}>
            {queue.map((entry, index) => {
                if (entry?.message?.length ?? 0 > 0) return null;
              return (index == queuePlaceholderIndex) ? 
               (
                <FlowsheetEntry
                  editable={true}
                  key={`queue-${index}`}
                  type={"placeholder"}
                />
               )
               : (
                <FlowsheetEntry
                  editable={true}
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
                  editable={true}
                  index = {index}
                  key={`entry-${index}`}
                  type={
                    entry?.message?.length ?? 0 > 0
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
  