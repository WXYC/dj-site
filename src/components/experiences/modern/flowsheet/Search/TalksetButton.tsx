"use client";

import { useAddToFlowsheetMutation } from "@/lib/features/flowsheet/api";
import { useFlowsheetSearch } from "@/src/hooks/flowsheetHooks";
import { Mic } from "@mui/icons-material";
import { IconButton, Tooltip } from "@mui/joy";

export default function TalksetButton() {
  const [addToFlowsheet] = useAddToFlowsheetMutation();

  const { live } = useFlowsheetSearch();

  return (
    <Tooltip placement="top" size="sm" title="Add a Talkset" variant="outlined">
      <IconButton
        size="sm"
        variant="solid"
        color="danger"
        onClick={() => {
          addToFlowsheet({
            message: "Talkset",
          });
        }}
        disabled={!live}
        sx = {{
            zIndex: 8001,
        }}
      >
        <Mic />
      </IconButton>
    </Tooltip>
  );
}
