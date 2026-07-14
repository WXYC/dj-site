"use client";

import {
  FlowsheetEntry,
  isFlowsheetEndShowEntry,
  isFlowsheetStartShowEntry,
} from "@/lib/features/flowsheet/types";
import { useShowControl } from "@/src/hooks/flowsheetHooks";
import { useMediaQuery } from "@/src/hooks/useMediaQuery";
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
import { FLOWSHEET_XL_QUERY } from "./tableStyles";

export default function MessageEntry({
  startDecorator,
  children,
  endDecorator,
  color,
  variant,
  entryRef,
  disableEditing = false,
  draggable = true,
}: {
  startDecorator?: React.ReactNode;
  children: React.ReactNode;
  endDecorator?: React.ReactNode;
  color: ColorPaletteProp;
  variant: VariantProp;
  entryRef: FlowsheetEntry;
  disableEditing?: boolean;
  draggable?: boolean;
}) {
  const { live, currentShow } = useShowControl();

  const controls = useDragControls();

  const isXl = useMediaQuery(FLOWSHEET_XL_QUERY);

  const editable = entryRef.show_id == currentShow && !disableEditing;

  return (
    <DraggableEntryWrapper
      controls={controls}
      entryRef={entryRef}
      variant={variant}
      color={color}
      draggable={draggable}
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
          rows. The span tracks the same media query SongEntry uses for the
          collapse, so the column counts stay in lock-step and the body mounts
          exactly once. Safe to gate with JS: the flowsheet pages only render
          after mount, so there's no SSR pass to mismatch. */}
      <Box
        component={"td"}
        style={{
          height: "30px",
          borderRadius: "md",
        }}
        colSpan={isXl ? 4 : 2}
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
          {live && editable && draggable && <DragButton controls={controls} />}
          {live && editable && !isFlowsheetStartShowEntry(entryRef) &&
            !isFlowsheetEndShowEntry(entryRef) && (
              <RemoveButton queue={false} entry={entryRef} />
            )}
        </Stack>
      </td>
    </DraggableEntryWrapper>
  );
}
