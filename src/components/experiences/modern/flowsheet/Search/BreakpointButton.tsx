"use client";

import { useAddToFlowsheetMutation } from "@/lib/features/flowsheet/api";
import {
  useCurrentBreakpointMessages,
  useFlowsheetSearch,
} from "@/src/hooks/flowsheetHooks";
import {
  formatStationHourLabel,
  isStationHourBreakpointPresent,
  stationBreakpointMessage,
} from "@/src/utilities/stationTime";
import { FlowsheetEntryType } from "@wxyc/shared/dtos";
import { Timer } from "@mui/icons-material";
import { IconButton, Tooltip } from "@mui/joy";

export default function BreakpointButton() {
  const [addToFlowsheet, _] = useAddToFlowsheetMutation();

  const { live } = useFlowsheetSearch();
  const breakpointMessages = useCurrentBreakpointMessages();

  const alreadyMarked = isStationHourBreakpointPresent(breakpointMessages);

  return (
    <Tooltip
      placement="top"
      size="sm"
      title={
        alreadyMarked
          ? "This hour already has a breakpoint"
          : `Add a ${formatStationHourLabel()} breakpoint`
      }
      variant="outlined"
    >
      <IconButton
        size="sm"
        variant="solid"
        color="warning"
        data-testid="flowsheet-breakpoint-button"
        onClick={() => {
          // Re-check against a fresh clock: the render-time value can be stale
          // if the station hour has rolled over since the last cache update.
          if (isStationHourBreakpointPresent(breakpointMessages)) return;
          addToFlowsheet({
            message: stationBreakpointMessage(),
            entry_type: FlowsheetEntryType.breakpoint,
          });
        }}
        disabled={!live || alreadyMarked}
        sx = {{
            zIndex: 8001,
        }}
      >
        <Timer />
      </IconButton>
    </Tooltip>
  );
}
