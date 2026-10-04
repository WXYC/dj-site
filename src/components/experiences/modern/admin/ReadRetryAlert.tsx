import { Alert, Button, Typography } from "@mui/joy";
import type { SxProps } from "@mui/joy/styles/types";

/**
 * Inline failure state for a Backend read: the message plus a Retry button.
 * Deliberately has no loading state — the alert is only mounted while the
 * query is rejected, and Retry moves it to pending, which unmounts the alert.
 */
export default function ReadRetryAlert({
  message,
  onRetry,
  sx,
}: {
  message: string;
  onRetry: () => void;
  sx?: SxProps;
}) {
  return (
    <Alert
      color="danger"
      sx={[{ justifyContent: "space-between" }, ...(Array.isArray(sx) ? sx : [sx])]}
    >
      <Typography>{message}</Typography>
      <Button variant="outlined" color="danger" size="sm" onClick={onRetry}>
        Retry
      </Button>
    </Alert>
  );
}
