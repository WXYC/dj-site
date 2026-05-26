"use client";

import {
  liveUpdatesSlice,
  type LiveUpdatesConnectionStatus,
} from "@/lib/features/flowsheet/live-updates-slice";
import { useAppSelector } from "@/lib/hooks";
import { Box, Tooltip } from "@mui/joy";

const STATUS_LABELS: Record<LiveUpdatesConnectionStatus, string> = {
  closed: "Live updates: off",
  connecting: "Live updates: connecting…",
  connected: "Live updates: connected",
  reconnecting: "Live updates: reconnecting…",
};

const STATUS_COLORS: Record<LiveUpdatesConnectionStatus, string> = {
  closed: "#9ca3af",
  connecting: "#fbbf24",
  connected: "#22c55e",
  reconnecting: "#fbbf24",
};

export default function SSEConnectionIndicator() {
  const status = useAppSelector(
    liveUpdatesSlice.selectors.selectLiveUpdatesConnectionStatus
  );
  const label = STATUS_LABELS[status];
  return (
    <Tooltip title={label} placement="bottom">
      <Box
        aria-label={label}
        sx={{
          display: "inline-block",
          width: 10,
          height: 10,
          borderRadius: "50%",
          backgroundColor: STATUS_COLORS[status],
          marginX: 0.5,
        }}
      />
    </Tooltip>
  );
}
