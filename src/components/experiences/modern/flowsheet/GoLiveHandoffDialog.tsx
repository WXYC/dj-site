"use client";

import {
  describeOpenShow,
  type JoinIntent,
} from "@/lib/features/flowsheet/go-live-handoff";
import type { GoLivePrompt } from "@/src/hooks/goLiveHandoffHooks";
import { Button, Stack } from "@mui/joy";
import ConfirmDialog from "@/src/components/experiences/modern/ConfirmDialog";

export default function GoLiveHandoffDialog({
  prompt,
  deciding,
  onDecide,
  onCancel,
}: {
  prompt: GoLivePrompt | null;
  deciding: boolean;
  onDecide: (intent: JoinIntent) => void;
  onCancel: () => void;
}) {
  if (!prompt) return null;

  const actions = (
    <Stack
      direction={{ xs: "column-reverse", sm: "row" }}
      spacing={1}
      sx={{ width: "100%", justifyContent: "flex-end" }}
    >
      <Button
        variant="plain"
        color="neutral"
        disabled={deciding}
        onClick={onCancel}
        data-testid="go-live-handoff-cancel"
      >
        Cancel
      </Button>
      <Button
        variant="outlined"
        color="neutral"
        loading={deciding}
        onClick={() => onDecide("join")}
        data-testid="go-live-handoff-join"
      >
        Join Existing Show
      </Button>
      {/* Destructive on purpose: it signs somebody else off the air. Any
          DJ may do it — the studio is the authority on who is at the
          controls — so the colour is the only thing standing between a
          deliberate handoff and a misread click. */}
      <Button
        variant="solid"
        color="danger"
        loading={deciding}
        onClick={() => onDecide("takeover")}
        data-testid="go-live-handoff-takeover"
      >
        End Existing Show
      </Button>
    </Stack>
  );

  return (
    <ConfirmDialog
      open
      onClose={onCancel}
      pending={deciding}
      title="A show is already on air"
      titleId="go-live-handoff-title"
      testId="go-live-handoff-dialog"
      sx={{ maxWidth: 460 }}
      actions={actions}
    >
      {describeOpenShow(prompt.handoff)}
      <br />
      Join them as a co-host, or end their show and start your own.
    </ConfirmDialog>
  );
}
