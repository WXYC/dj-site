import { FlowsheetSongEntry } from "@/lib/features/flowsheet/types";
import { useQueue } from "@/src/hooks/flowsheetHooks";
import { RemoveFromQueue } from "@mui/icons-material";
import { IconButton, IconButtonProps, Tooltip } from "@mui/joy";

export default function RemoveFromQueueButton({
  entry,
  ...props
}: IconButtonProps & { entry: FlowsheetSongEntry }) {
  const { removeFromQueue, loading } = useQueue();

  return (
    <Tooltip title={`Remove ${entry.album_title} from queue`}>
      <IconButton
        onClick={() => removeFromQueue(entry.id)}
        loading={loading}
        {...props}
      >
        <RemoveFromQueue />
      </IconButton>
    </Tooltip>
  );
}
