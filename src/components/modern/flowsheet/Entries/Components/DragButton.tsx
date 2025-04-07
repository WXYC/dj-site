import { FlowsheetEntry } from "@/lib/features/flowsheet/types";
import { DragIndicator } from "@mui/icons-material";
import { IconButton } from "@mui/joy";

export default function DragButton({
  entry,
  queue,
  rectRef,
}: {
  entry: FlowsheetEntry;
  queue: boolean;
  rectRef?: any;
}) {
  return (
    <IconButton
      color="neutral"
      variant="plain"
      size="sm"
      sx={{
        cursor: "grab",
        "&:hover": {
          background: "none",
        },
      }}
      onMouseDown={(e) => {
        /*queue
                  ? setQueuePlaceholderIndex(props.index)
                  : setEntryPlaceholderIndex(props.index);
                let rect = entryClientRectRef.current.getBoundingClientRect();
                let button = e.target.getBoundingClientRect();
                setEntryClientRect({
                  x: rect.x,
                  y: rect.y,
                  width: rect.width,
                  height: rect.height,
                  offsetX: button.x - rect.x + 5,
                  offsetY: button.y - rect.y + 5,
                });*/
      }}
    >
      <DragIndicator />
    </IconButton>
  );
}
