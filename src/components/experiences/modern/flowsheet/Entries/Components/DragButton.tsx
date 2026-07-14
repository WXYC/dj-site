import { DragIndicator } from "@mui/icons-material";
import { IconButton } from "@mui/joy";
import { DragControls } from "motion/react";
import { FLOWSHEET_DRAG_GUTTER_PX } from "../tableStyles";

/**
 * The drag grip. Renders in the same spot for every entry type: absolutely
 * positioned out of the row box into the page-background gutter left of the
 * table (see FLOWSHEET_DRAG_GUTTER_PX), vertically centered on the row.
 * Must be a direct child of the row's FIRST cell, and that cell must be
 * `position: relative` to anchor it.
 */
export default function DragButton({ controls }: { controls: DragControls }) {
  return (
    <IconButton
      color="neutral"
      variant="plain"
      size="sm"
      sx={{
        position: "absolute",
        left: `-${FLOWSHEET_DRAG_GUTTER_PX}px`,
        top: "50%",
        transform: "translateY(-50%)",
        cursor: "grab",
        touchAction: "none",
        "&:hover": {
          background: "none",
        },
      }}
      onPointerDown={(e) => controls.start(e)}
    >
      <DragIndicator />
    </IconButton>
  );
}
