"use client";

import { useAddToFlowsheetMutation } from "@/lib/features/flowsheet/api";
import {
  useCurrentBreakpointHours,
  useFlowsheetSearch,
} from "@/src/hooks/flowsheetHooks";
import {
  breakpointGuardRejectionMessage,
  formatStationHourLabel,
  isStationHourBreakpointPresent,
  stationBreakpointMessage,
} from "@/src/utilities/stationTime";
import { FlowsheetEntryType } from "@wxyc/shared/dtos";
import { Timer } from "@mui/icons-material";
import { IconButton, Tooltip } from "@mui/joy";
import { toast } from "sonner";

export default function BreakpointButton() {
  const [addToFlowsheet, _] = useAddToFlowsheetMutation();

  const { live } = useFlowsheetSearch();
  const breakpointHours = useCurrentBreakpointHours();

  const alreadyMarked = isStationHourBreakpointPresent(breakpointHours);

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
          //
          // One clock read for the check, the toast copy, and the written
          // message alike: independent `new Date()` calls can straddle the :30
          // rounding boundary and name an hour the check never looked at.
          const now = new Date();
          if (isStationHourBreakpointPresent(breakpointHours, now)) {
            // The tooltip states the rule on hover, but a click has to answer
            // for itself -- toast is how the rest of the flowsheet tree
            // reports a refused write.
            toast.error(
              breakpointGuardRejectionMessage(formatStationHourLabel(now))
            );
            return;
          }
          addToFlowsheet({
            message: stationBreakpointMessage(now),
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
