"use client";

import { useShowControl } from "@/src/hooks/flowsheetHooks";
import {
  PlayArrow,
  PlayDisabled,
  PortableWifiOff,
  WifiTethering,
} from "@mui/icons-material";
import { Button, ButtonGroup, IconButton, Tooltip } from "@mui/joy";

export default function GoLive() {
  const { live, autoplay, setAutoPlay, loading, goLive, leave } =
    useShowControl();

  return (
    <>
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
      <ButtonGroup>
        <Tooltip
          title={loading ? "Loading..." : live ? "Leave" : "Go Live"}
          placement="top"
          size="sm"
          variant="outlined"
        >
          <IconButton
            variant="outlined"
            onClick={() => (live ? leave() : goLive())}
            disabled={loading}
          >
            {live ? <PortableWifiOff /> : <WifiTethering />}
          </IconButton>
        </Tooltip>
        <Tooltip
          title={
            live
              ? "Click the button at left to leave"
              : "Click the button at left to go live"
          }
        >
          <Button
            variant={live ? "solid" : "outlined"}
            color={live ? "primary" : "neutral"}
            sx={{
              pointerEvents: "none",
            }}
            loading={loading}
          >
            {live ? "You Are On Air  🔴" : "You Are Off Air  ⬤"}
          </Button>
        </Tooltip>
      </ButtonGroup>
    </>
  );
}
