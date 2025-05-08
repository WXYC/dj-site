import { DragIndicator } from "@mui/icons-material";
import { IconButton } from "@mui/joy";
import { DragControls } from "motion/react";

export default function DragButton({ controls }: { controls: DragControls }) {
  return (
    <IconButton
      color="neutral"
      variant="plain"
      size="sm"
      sx={{
        ml: "-30px",
        cursor: "grab",
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
