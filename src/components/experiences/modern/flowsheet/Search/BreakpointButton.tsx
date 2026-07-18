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
          // The click handler is the enforcement point, re-derived from a fresh
          // clock. The button is NOT disabled on `alreadyMarked` on purpose:
          // that state is computed from render-time `new Date()` with no
          // hour-boundary re-render, so a disabled button could outlive its
          // station hour (structural sharing keeps the data reference stable
          // across quiet polls) and lock out the next, legitimate hour.
          if (isStationHourBreakpointPresent(breakpointMessages)) return;
          addToFlowsheet({
            message: stationBreakpointMessage(),
            entry_type: FlowsheetEntryType.breakpoint,
          });
        }}
        disabled={!live}
        sx = {{
            zIndex: 8001,
        }}
      >
        <Timer />
      </IconButton>
    </Tooltip>
  );
}
