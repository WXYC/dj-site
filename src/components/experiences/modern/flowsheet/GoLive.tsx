"use client";

import {
  useFlowsheetSaving,
  useShowControl,
} from "@/src/hooks/flowsheetHooks";
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
import { useEffect, useState } from "react";
import { useGoLiveHandoff } from "@/src/hooks/goLiveHandoffHooks";
import GoLiveHandoffDialog from "./GoLiveHandoffDialog";

export default function GoLive() {
  const { live, autoplay, setAutoPlay, loading, goLive, leave } =
    useShowControl();
  const isSaving = useFlowsheetSaving();
  // Prompt state lives here, not in useShowControl — that hook runs in every
  // entry row, so opening the dialog from there would re-render the table.
  const { prompt, deciding, requestGoLive, decide, cancel } =
    useGoLiveHandoff(goLive);

  // Both controls below route through this. The icon button used to carry its
  // own copy of the toggle, which would have made it a silent bypass of the
  // handoff prompt — the one path where a DJ can still be attached to somebody
  // else's show without being asked.
  const toggle = () => {
    if (live) {
      leave();
      return;
    }
    void requestGoLive();
  };

  // Must match the server's markup until this flips true post-mount, or the
  // aria-label/disabled/loading props React hydrates onto these elements
  // won't match server HTML.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  // SSR always renders as if the session were still unresolved (mounted is
  // false server-side too), so the client's first pass must hold `loading`
  // true regardless of the real value or React sees a disabled/Mui-loading
  // class diff during hydration.
  const effectiveLoading = mounted ? loading : true;
  const goLiveLabel = effectiveLoading
    ? "Loading..."
    : live
      ? "Click to leave"
      : "Click to go live";

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
        title={goLiveLabel}
        placement="top"
        size="sm"
        variant="outlined"
      >
        <ButtonGroup>
          <IconButton
            variant="outlined"
            onClick={toggle}
            disabled={effectiveLoading}
            data-testid="flowsheet-go-live-button"
          >
            {live ? <PortableWifiOff /> : <WifiTethering />}
          </IconButton>
          <Button
            variant={live ? "solid" : "outlined"}
            color={live ? "primary" : "neutral"}
            onClick={toggle}
            disabled={effectiveLoading}
            loading={effectiveLoading}
            data-testid="flowsheet-live-status"
            sx={{ transition: "all 0.25s ease" }}
          >
            {live ? "You Are On Air" : "You Are Off Air"}
            <Box
              sx={{
                width: 10,
                height: 10,
                borderRadius: "50%",
                flexShrink: 0,
                ml: 1,
                backgroundColor: live
                  ? "var(--wxyc-palette-onAir-indicator)"
                  : "neutral.500",
                boxShadow: live
                  ? "0 0 6px 2px var(--wxyc-palette-onAir-glow)"
                  : "none",
                transition: "all 0.25s ease",
              }}
            />
          </Button>
        </ButtonGroup>
      </Tooltip>
      <GoLiveHandoffDialog
        prompt={prompt}
        deciding={deciding}
        onDecide={(intent) => void decide(intent)}
        onCancel={cancel}
      />
    </Stack>
  );
}
