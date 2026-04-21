"use client";

import { useShowControl } from "@/src/hooks/flowsheetHooks";
import {
  PlayArrow,
  PlayDisabled,
  PortableWifiOff,
  WifiTethering,
} from "@mui/icons-material";
import {
  Box,
  Button,
  ButtonGroup,
  CircularProgress,
  IconButton,
  Stack,
  Tooltip,
} from "@mui/joy";

export default function GoLive() {
  const { live, autoplay, setAutoPlay, loading, isSaving, goLive, leave } =
    useShowControl();

  return (
    <Stack direction="row" spacing={1} alignItems="center">
      <Tooltip
        title={`Autoplay is ${autoplay ? "On" : "Off"}`}
        placement="top"
        size="sm"
        variant="outlined"
      >
        <IconButton
          disabled={!live}
          variant="outlined"
          color={autoplay ? "primary" : "neutral"}
          onClick={() => setAutoPlay(!autoplay)}
        >
          {autoplay ? <PlayArrow /> : <PlayDisabled />}
        </IconButton>
      </Tooltip>
      {isSaving ? (
        <Tooltip title="Saving changes…" placement="top" variant="outlined">
          <CircularProgress
            size="sm"
            color="neutral"
            variant="soft"
            sx={{ "--CircularProgress-size": "22px" }}
          />
        </Tooltip>
      ) : null}
      <Tooltip
        title={loading ? "Loading..." : live ? "Click to leave" : "Click to go live"}
        placement="top"
        size="sm"
        variant="outlined"
      >
        <ButtonGroup>
          <IconButton
            variant="outlined"
            onClick={() => (live ? leave() : goLive())}
            disabled={loading}
            data-testid="flowsheet-go-live-button"
          >
            {live ? <PortableWifiOff /> : <WifiTethering />}
          </IconButton>
          <Button
            variant={live ? "solid" : "outlined"}
            color={live ? "primary" : "neutral"}
            onClick={() => (live ? leave() : goLive())}
            disabled={loading}
            loading={loading}
            data-testid="flowsheet-live-status"
            sx={{ transition: "all 0.25s ease" }}
          >
            {live ? "You Are On Air" : "You Are Off Air"}
            <Box
              sx={{
                width: 10,
                height: 10,
                borderRadius: "50%",
                ml: 1,
                backgroundColor: live ? "#ef4444" : "neutral.500",
                boxShadow: live ? "0 0 6px 2px rgba(239, 68, 68, 0.5)" : "none",
                transition: "all 0.25s ease",
              }}
            />
          </Button>
        </ButtonGroup>
      </Tooltip>
    </Stack>
  );
}
