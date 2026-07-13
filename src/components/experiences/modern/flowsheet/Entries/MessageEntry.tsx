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
      className="row-marker"
      style={{
        height: "40px",
        borderRadius: "md",
      }}
    >
      <td>
        <AspectRatio
          ratio={1.5}
          variant="plain"
          sx={{
            flexBasis: "calc(60px - 12px)",
            borderRadius: "9px",
            minWidth: "48px",
            minHeight: "20px",
          }}
        >
          <Typography>{startDecorator}</Typography>
        </AspectRatio>
      </td>
      {/* The middle spans every text column. Because SongEntry collapses its
          artist and label columns below xl (6 → 4 columns), the marker's span
          has to shrink too, or it forces phantom columns that squash the song
          rows. Two cells toggled purely by CSS keep the column counts in lock-
          step with SongEntry at each breakpoint (no JS, so no hydration flash);
          only the matching one is ever laid out. */}
      <Box
        component={"td"}
        style={{
          height: "30px",
          borderRadius: "md",
        }}
        colSpan={4}
        sx={{ display: { xs: "none", xl: "table-cell" } }}
      >
        {children}
      </Box>
      <Box
        component={"td"}
        style={{
          height: "30px",
          borderRadius: "md",
        }}
        colSpan={2}
        sx={{ display: { xs: "table-cell", xl: "none" } }}
      >
        {children}
      </Box>
      <td>
        <Stack
          direction="row"
          spacing={0.5}
          alignItems="center"
          justifyContent="end"
        >
          <Typography level="body-xs">{endDecorator}</Typography>
          {live && editable && <DragButton controls={controls} />}
          {live && editable && !isFlowsheetStartShowEntry(entryRef) &&
            !isFlowsheetEndShowEntry(entryRef) && (
              <RemoveButton queue={false} entry={entryRef} />
            )}
        </Stack>
      </td>
    </DraggableEntryWrapper>
  );
}
