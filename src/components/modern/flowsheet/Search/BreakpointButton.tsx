"use client";

import { useAddToFlowsheetMutation } from "@/lib/features/flowsheet/api";
import { isFlowsheetBreakpointEntry } from "@/lib/features/flowsheet/types";
import { useFlowsheet, useFlowsheetSearch } from "@/src/hooks/flowsheetHooks";
import { getClosestHour, parseTimeStringToDate } from "@/src/utilities/closesthour";
import { Timer } from "@mui/icons-material";
import { IconButton, Tooltip } from "@mui/joy";
import { useCallback, useEffect, useState } from "react";

export default function BreakpointButton() {
  const [addToFlowsheet, addToFlowsheetResult] = useAddToFlowsheetMutation();

  const { live } = useFlowsheetSearch();
  const { entries } = useFlowsheet();

  const [breakpointAvailable, setBreakpointAvailable] = useState(false);

  const updateBreakpointAvailability = useCallback(() => {
    if (entries) {
      const breakpoint = entries.find((entry) =>
        isFlowsheetBreakpointEntry(entry)
      );
      if (breakpoint) {
        let cutoff = getClosestHour();
        setBreakpointAvailable(
            parseTimeStringToDate(breakpoint.date_string) < cutoff
        );
        console.log("Most recent breakpoint:", parseTimeStringToDate(breakpoint.date_string));
        console.log("Most recent breakpoint raw:", breakpoint.date_string);
      }
    }
  }, [entries]);

  useEffect(() => {
    var timer = setInterval(() => {
      updateBreakpointAvailability();
    }, 4000);
    return () => {
      clearInterval(timer);
    };
  }, [updateBreakpointAvailability]);

  return (
    <Tooltip
      placement="top"
      size="sm"
      title="Add a Breakpoint"
      variant="outlined"
    >
      <IconButton
        size="sm"
        variant="solid"
        color="warning"
        onClick={() => {
          const now = getClosestHour();

          addToFlowsheet({
            message: `${now.toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })} Breakpoint`,
          });
        }}
        disabled={
          !live ||
          !breakpointAvailable
        }
      >
        <Timer />
      </IconButton>
    </Tooltip>
  );
}
