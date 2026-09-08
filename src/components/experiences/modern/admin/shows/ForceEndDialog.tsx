"use client";

import {
  classifyForceEndError,
  FORCE_END_COPY,
  FORCE_END_TESTIDS,
  FORCE_END_TITLE_ID,
} from "@/lib/features/flowsheet/force-end-outcome";
import { useForceEndShowMutation } from "@/lib/features/flowsheet/api";
import type { OpenShow } from "@/lib/features/flowsheet/types";
import ConfirmDialog from "@/src/components/experiences/modern/ConfirmDialog";
import { Button, Stack, Typography } from "@mui/joy";
import { useState } from "react";
import { toast } from "sonner";

/**
 * The force-end confirmation. The caller mounts one instance per target
 * (keyed by show id), so `escalated` resets with the target and can never
 * carry a previous show's 409 over to a new one.
 */
export default function ForceEndDialog({
  show,
  onClose,
}: {
  show: OpenShow;
  onClose: () => void;
}) {
  const [forceEnd, { isLoading }] = useForceEndShowMutation();
  // Set by a 409: the show became current between render and click. The
  // server's consent gate held; the dialog re-asks with the danger copy and
  // only the operator's second confirmation sends force — never an auto-retry.
  const [escalated, setEscalated] = useState(false);

  const isCurrent = show.is_current || escalated;

  const decide = async () => {
    try {
      await forceEnd({ showId: show.id, force: isCurrent }).unwrap();
      toast.success(FORCE_END_COPY.ended);
      onClose();
    } catch (err) {
      switch (classifyForceEndError(err)) {
        case "already_ended":
          // The operator's goal state is reached; the refetch the mutation's
          // invalidation already issued will drop the row.
          toast.success(FORCE_END_COPY.alreadyEnded);
          onClose();
          return;
        case "now_on_air":
          setEscalated(true);
          return;
        case "refused":
          toast.error(FORCE_END_COPY.refused);
          onClose();
          return;
        case "indeterminate":
          toast.error(FORCE_END_COPY.indeterminate);
          onClose();
          return;
      }
    }
  };

  const actions = (
    <Stack
      direction={{ xs: "column-reverse", sm: "row" }}
      spacing={1}
      sx={{ width: "100%", justifyContent: "flex-end" }}
    >
      <Button
        variant="plain"
        color="neutral"
        disabled={isLoading}
        onClick={onClose}
        data-testid={FORCE_END_TESTIDS.cancel}
      >
        {FORCE_END_COPY.cancel}
      </Button>
      {/* Danger for the current show only: ending an abandoned show is
          routine cleanup, ending the current one signs a person off the
          air, and the colour is what separates the two at a glance. */}
      <Button
        variant="solid"
        color={isCurrent ? "danger" : "primary"}
        loading={isLoading}
        onClick={() => void decide()}
        data-testid={FORCE_END_TESTIDS.confirm}
      >
        {FORCE_END_COPY.confirm}
      </Button>
    </Stack>
  );

  return (
    <ConfirmDialog
      open
      onClose={onClose}
      pending={isLoading}
      title={FORCE_END_COPY.title}
      titleId={FORCE_END_TITLE_ID}
      testId={FORCE_END_TESTIDS.dialog}
      sx={{ maxWidth: 460 }}
      actions={actions}
    >
      {isCurrent ? (
        <Typography color="danger" fontWeight="lg">
          {FORCE_END_COPY.currentWarning}
        </Typography>
      ) : null}
      <Typography>
        {show.dj_name ?? "An unnamed DJ"}
        {show.show_name ? ` — ${show.show_name}` : ""}, started{" "}
        {new Date(show.start_time).toLocaleString()}, {show.entry_count}{" "}
        {show.entry_count === 1 ? "entry" : "entries"}.
      </Typography>
      <Typography>{FORCE_END_COPY.choice}</Typography>
    </ConfirmDialog>
  );
}
