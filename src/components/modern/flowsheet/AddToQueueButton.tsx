import { FlowsheetQuery } from "@/lib/features/flowsheet/types";
import { useQueue } from "@/src/hooks/flowsheetHooks";
import { QueueMusic } from "@mui/icons-material";
import { IconButton, IconButtonProps, Tooltip } from "@mui/joy";

export default function AddToQueueButton({
  entry,
  ...props
}: IconButtonProps & { entry: FlowsheetQuery }) {
  const { addToQueue, loading } = useQueue();

  return (
    <Tooltip title={`Add ${entry.album} to queue`}>
      <IconButton
        onClick={() => addToQueue(entry)}
        loading={loading}
        {...props}
      >
        <QueueMusic />
      </IconButton>
    </Tooltip>
  );
}
