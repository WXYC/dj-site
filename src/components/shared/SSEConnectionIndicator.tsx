"use client";

import {
  liveUpdatesSlice,
  type LiveUpdatesConnectionStatus,
} from "@/lib/features/flowsheet/live-updates-slice";
import { useAppSelector } from "@/lib/hooks";
import { Box, Tooltip } from "@mui/joy";
import type { ColorPaletteProp } from "@mui/joy/styles";

const STATUS_LABELS: Record<LiveUpdatesConnectionStatus, string> = {
  closed: "Live updates: off",
  connecting: "Live updates: connecting…",
  connected: "Live updates: connected",
  reconnecting: "Live updates: reconnecting…",
};

const STATUS_PALETTE: Record<LiveUpdatesConnectionStatus, ColorPaletteProp> = {
  closed: "neutral",
  connecting: "warning",
  connected: "success",
  reconnecting: "warning",
};

export default function SSEConnectionIndicator() {
  const status = useAppSelector(
    liveUpdatesSlice.selectors.selectLiveUpdatesConnectionStatus
  );
  const label = STATUS_LABELS[status];
  const palette = STATUS_PALETTE[status];
  return (
    <Tooltip title={label} placement="bottom">
      <Box
        aria-label={label}
        data-status={status}
        sx={(theme) => ({
          display: "inline-block",
          borderRadius: "50%",
          backgroundColor: theme.vars.palette[palette].solidBg,
          marginX: 0.5,
          // The page header forces min-width 100% + grow on every direct
          // child to stack them full-width on narrow screens; min-width
          // overpowers a plain width, so the dot pins both axes and opts
          // out of flex sizing, doubled for a deterministic cascade win
          // over that equal-specificity child selector.
          "&&": {
            width: 10,
            height: 10,
            minWidth: 10,
            maxWidth: 10,
            flexGrow: 0,
            flexShrink: 0,
          },
        })}
      />
    </Tooltip>
  );
}
