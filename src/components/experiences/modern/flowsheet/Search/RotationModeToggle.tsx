"use client";

import { flowsheetSlice } from "@/lib/features/flowsheet/frontend";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { useFlowsheetSearch } from "@/src/hooks/flowsheetHooks";
import { Album } from "@mui/icons-material";
import { IconButton, Tooltip } from "@mui/joy";

export default function RotationModeToggle() {
  const dispatch = useAppDispatch();
  const rotationMode = useAppSelector(flowsheetSlice.selectors.getRotationMode);
  const { live } = useFlowsheetSearch();

  return (
    <Tooltip
      placement="top"
      size="sm"
      title={rotationMode ? "Switch to Search Mode" : "Rotation Entry Mode"}
      variant="outlined"
    >
      <IconButton
        size="sm"
        variant={rotationMode ? "solid" : "outlined"}
        color={rotationMode ? "primary" : "neutral"}
        data-testid="flowsheet-rotation-toggle"
        onClick={() => dispatch(flowsheetSlice.actions.setRotationMode(!rotationMode))}
        disabled={!live}
        sx={{
          zIndex: 8001,
        }}
      >
        <Album />
      </IconButton>
    </Tooltip>
  );
}
