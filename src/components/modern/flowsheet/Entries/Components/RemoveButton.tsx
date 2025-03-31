import { FlowsheetEntry } from "@/lib/features/flowsheet/types";
import { useFlowsheet } from "@/src/hooks/flowsheetHooks";
import { Clear } from "@mui/icons-material";
import { Button } from "@mui/joy";

export default function RemoveButton({
  canClose,
  playing,
  queue,
  entry,
}: {
  canClose: boolean;
  playing: boolean;
  queue: boolean;
  entry: FlowsheetEntry;
}) {
  const { removeFromQueue, removeFromFlowsheet } = useFlowsheet();

  return canClose && !playing ? (
    <Button
      color="neutral"
      variant="solid"
      sx={{
        position: "absolute",
        zIndex: 4,
        top: "50%",
        transform: "translateY(-50%)",
        right: 10,
        minWidth: "3px",
        minHeight: "3px",
        maxWidth: "3px",
        maxHeight: "3px",
        background: "transparent",
        p: 0,
        "& svg": {
          width: "15px",
          height: "15px",
        },
        "&:hover": {
          background: "transparent",
        },
      }}
      onClick={() =>
        queue ? removeFromQueue(entry.id) : removeFromFlowsheet(entry.id)
      }
    >
      <Clear color="secondary" />
    </Button>
  ) : null;
}
