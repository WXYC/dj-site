"use client";

import { useAddToFlowsheetMutation } from "@/lib/features/flowsheet/api";
import { useFlowsheetSearch } from "@/src/hooks/flowsheetHooks";
import { getClosestHour } from "@/src/utilities/closesthour";
import { Timer } from "@mui/icons-material";
import { IconButton, Tooltip } from "@mui/joy";

export default function BreakpointButton() {
  const [addToFlowsheet, _] = useAddToFlowsheetMutation();

  const { live } = useFlowsheetSearch();

  return (
    <Tooltip
      placement="top"
      size="sm"
      title={`Add a ${getClosestHour().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })} breakpoint`}
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
