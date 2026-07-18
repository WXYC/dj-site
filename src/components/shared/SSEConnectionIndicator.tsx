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
          width: 10,
          height: 10,
          borderRadius: "50%",
          flexShrink: 0,
          aspectRatio: "1",
          backgroundColor: theme.vars.palette[palette].solidBg,
          marginX: 0.5,
        })}
      />
    </Tooltip>
  );
}
