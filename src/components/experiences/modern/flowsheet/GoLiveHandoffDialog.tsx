"use client";

import {
  GO_LIVE_HANDOFF_COPY,
  GO_LIVE_HANDOFF_TAKEOVER_ONLY_COPY,
  GO_LIVE_HANDOFF_TESTIDS,
  GO_LIVE_HANDOFF_TITLE_ID,
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

  // A DJ already on air on the open show is already a co-host, so the join
  // request that button would send is one the server answers 200 and acts on
  // not at all: the dialog would close having changed nothing, leaving them
  // exactly where they pressed. Dropping the button — rather than disabling it
  // — is what makes the remaining one legible as the answer. They get the same
  // offer classic gives every DJ, for the same reason it gives it.
  const canCoHost = !prompt.callerIsOnAir;
  const copy = canCoHost
    ? GO_LIVE_HANDOFF_COPY
    : GO_LIVE_HANDOFF_TAKEOVER_ONLY_COPY;

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
        {copy.cancel}
      </Button>
      {canCoHost ? (
        <Button
          variant="outlined"
          color="neutral"
          loading={deciding}
          onClick={() => onDecide("join")}
          data-testid={GO_LIVE_HANDOFF_TESTIDS.join}
        >
          {GO_LIVE_HANDOFF_COPY.join}
        </Button>
      ) : null}
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
        {copy.takeover}
      </Button>
    </Stack>
  );

  return (
    <ConfirmDialog
      open
      onClose={onCancel}
      pending={deciding}
      title={GO_LIVE_HANDOFF_COPY.title}
      titleId={GO_LIVE_HANDOFF_TITLE_ID}
      testId={GO_LIVE_HANDOFF_TESTIDS.dialog}
      sx={{ maxWidth: 460 }}
      actions={actions}
    >
      {describeOpenShow(prompt.handoff)}
      <br />
      {copy.choice}
    </ConfirmDialog>
  );
}
