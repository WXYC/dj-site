"use client";

import { liveUpdatesSlice } from "@/lib/features/flowsheet/live-updates-slice";
import { useAppSelector } from "@/lib/hooks";
import { Box, Tooltip } from "@mui/joy";

const STATUS_LABELS: Record<string, string> = {
  closed: "Live updates: off",
  connecting: "Live updates: connecting…",
  connected: "Live updates: connected",
  reconnecting: "Live updates: reconnecting…",
};

const STATUS_COLORS: Record<string, string> = {
  closed: "#9ca3af",
  connecting: "#fbbf24",
  connected: "#22c55e",
  reconnecting: "#fbbf24",
};

/**
 * Small dot + tooltip that surfaces the live-updates SSE connection state.
 * Rendered only on dashboards (modern + classic chrome); the public `/live`
 * page does not show it.
 */
export default function SSEConnectionIndicator() {
  const status = useAppSelector(
    liveUpdatesSlice.selectors.selectLiveUpdatesConnectionStatus
  );
  return (
    <Tooltip title={STATUS_LABELS[status] ?? status} placement="bottom">
      <Box
        aria-label={STATUS_LABELS[status] ?? status}
        sx={{
          display: "inline-block",
          width: 10,
          height: 10,
          borderRadius: "50%",
          backgroundColor: STATUS_COLORS[status] ?? "#9ca3af",
          marginX: 0.5,
        }}
      />
    </Tooltip>
  );
}
