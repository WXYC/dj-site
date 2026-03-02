import type { DragControls } from "motion/react";

export default function DragButton(props: { controls: DragControls }) {
  // Dragging disabled for now
  void props;
  return null;
  
  // Uncomment to re-enable dragging:
  // return (
  //   <IconButton
  //     color="neutral"
  //     variant="plain"
  //     size="sm"
  //     sx={{
  //       ml: "-30px",
  //       cursor: "grab",
  //       "&:hover": {
  //         background: "none",
  //       },
  //     }}
  //     onPointerDown={(e) => controls.start(e)}
  //   >
  //     <DragIndicator />
  //   </IconButton>
  // );
}
