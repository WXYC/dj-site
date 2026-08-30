"use client";

import {
  GO_LIVE_HANDOFF_COPY,
  GO_LIVE_HANDOFF_TESTIDS,
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
        data-testid={GO_LIVE_HANDOFF_TESTIDS.cancel}
      >
        {GO_LIVE_HANDOFF_COPY.cancel}
      </Button>
      <Button
        variant="outlined"
        color="neutral"
        loading={deciding}
        onClick={() => onDecide("join")}
        data-testid={GO_LIVE_HANDOFF_TESTIDS.join}
      >
        {GO_LIVE_HANDOFF_COPY.join}
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
        data-testid={GO_LIVE_HANDOFF_TESTIDS.takeover}
      >
        {GO_LIVE_HANDOFF_COPY.takeover}
      </Button>
    </Stack>
  );

  return (
    <ConfirmDialog
      open
      onClose={onCancel}
      pending={deciding}
      title={GO_LIVE_HANDOFF_COPY.title}
      titleId={GO_LIVE_HANDOFF_TESTIDS.title}
      testId={GO_LIVE_HANDOFF_TESTIDS.dialog}
      sx={{ maxWidth: 460 }}
      actions={actions}
    >
      {describeOpenShow(prompt.handoff)}
      <br />
      {GO_LIVE_HANDOFF_COPY.choice}
    </ConfirmDialog>
  );
}
