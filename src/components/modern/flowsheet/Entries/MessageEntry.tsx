"use client";

import {
  FlowsheetEntry,
  isFlowsheetEndShowEntry,
  isFlowsheetStartShowEntry,
} from "@/lib/features/flowsheet/types";
import { useShowControl } from "@/src/hooks/flowsheetHooks";
import {
  AspectRatio,
  Box,
  ColorPaletteProp,
  Stack,
  Typography,
  VariantProp,
} from "@mui/joy";
import { useDragControls } from "motion/react";
import DragButton from "./Components/DragButton";
import RemoveButton from "./Components/RemoveButton";
import DraggableEntryWrapper from "./DraggableEntryWrapper";

export default function MessageEntry({
  startDecorator,
  children,
  endDecorator,
  color,
  variant,
  entryRef,
  disableEditing = false,
}: {
  startDecorator?: React.ReactNode;
  children: React.ReactNode;
  endDecorator?: React.ReactNode;
  color: ColorPaletteProp;
  variant: VariantProp;
  entryRef: FlowsheetEntry;
  disableEditing?: boolean;
}) {
  const { live, currentShow } = useShowControl();

  const controls = useDragControls();

  const editable = entryRef.show_id == currentShow && !disableEditing;

  return (
    <DraggableEntryWrapper
      controls={controls}
      entryRef={entryRef}
      variant={variant}
      color={color}
      style={{
        height: "40px",
        borderRadius: "8px",
      }}
    >
      {/* Icon Section */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          width: "60px",
        }}
      >
        <AspectRatio
          ratio={1.5}
          variant="plain"
          sx={{
            width: "48px",
            borderRadius: "9px",
            minWidth: "48px",
            minHeight: "20px",
          }}
        >
          <Typography>{startDecorator}</Typography>
        </AspectRatio>
      </Box>

      <Box
        sx={{
          flex: 4,
          minWidth: 0,
          display: "flex",
          alignItems: "center",
          px: 1,
        }}
      >
        {children}
      </Box>

      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          flexShrink: 0,
          gap: 0.5,
        }}
      >
        <Typography level="body-xs">{endDecorator}</Typography>
        {live && editable && <DragButton controls={controls} />}
        {live && editable && !isFlowsheetStartShowEntry(entryRef) &&
          !isFlowsheetEndShowEntry(entryRef) && (
            <RemoveButton queue={false} entry={entryRef} />
          )}
      </Box>
    </DraggableEntryWrapper>
  );
}
