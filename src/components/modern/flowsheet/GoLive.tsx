"use client";

import { useShowControl } from "@/src/hooks/flowsheetHooks";
import {
  PlayArrow,
  PlayDisabled,
  PortableWifiOff,
  WifiTethering,
} from "@mui/icons-material";
import { Button, IconButton, Tooltip } from "@mui/joy";

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
      <Button
        variant={live ? "solid" : "outlined"}
        color={live ? "primary" : "neutral"}
        startDecorator={live ? <WifiTethering /> : <PortableWifiOff />}
        onClick={() => (live ? leave() : goLive())}
        disabled={loading}
        loading={loading}
      >
        {live ? "You Are On Air" : "You Are Off Air"}
      </Button>
    </>
  );
}
