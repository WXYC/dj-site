import {
  FlowsheetEntry,
  isFlowsheetSongEntry,
} from "@/lib/features/flowsheet/types";
import { useFlowsheet } from "@/src/hooks/flowsheetHooks";
import { Clear } from "@mui/icons-material";
import { IconButton, Tooltip } from "@mui/joy";

export default function RemoveButton({
  queue,
  entry,
}: {
  queue: boolean;
  entry: FlowsheetEntry;
}) {
  const { removeFromQueue, removeFromFlowsheet } = useFlowsheet();

  return (
    <Tooltip
      variant="plain"
      placement="top-start"
      size="sm"
      title={
        isFlowsheetSongEntry(entry)
          ? `Remove ${entry.track_title} from ${queue ? "Queue" : "Flowsheet"}`
          : `Remove from ${queue ? "Queue" : "Flowsheet"}`
      }
    >
      <IconButton
        color="neutral"
        size="sm"
        onClick={() =>
          queue ? removeFromQueue(entry.id) : removeFromFlowsheet(entry.id)
        }
      >
        <Clear color="secondary" fontSize="small" />
      </IconButton>
    </Tooltip>
  );
}
