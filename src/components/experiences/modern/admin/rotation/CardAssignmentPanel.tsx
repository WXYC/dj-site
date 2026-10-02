"use client";

import type { JSX } from "react";
import { useState } from "react";
import type { RotationCard } from "@wxyc/shared";
import { useGetRotationListQuery } from "@/lib/features/rotation/api";
import { rotationRowsToMoveOntoCard } from "@/lib/features/rotation/cards";
import type { CardMoveRowOutcome } from "@/lib/features/rotation/moveRowsOntoCard";
import { ROTATION_BIN_LABELS, type RotationListRow } from "@/lib/features/rotation/types";
import { rotationWriteErrorMessage } from "@/lib/features/rotation/writeErrorMessage";
import ConfirmDialog from "@/src/components/experiences/modern/ConfirmDialog";
import { Button, Checkbox, Stack, Typography } from "@mui/joy";
import { useCardAssignmentSave } from "./useCardAssignmentSave";

export type CardAssignmentPanelProps = { card: RotationCard; onClose: () => void };

type RowProps = {
  row: RotationListRow;
  here: boolean;
  checked: boolean;
  locked: boolean;
  onToggle: (rotationId: number) => void;
  targetLabel: string;
  outcome: CardMoveRowOutcome | undefined;
};

// A row's status line, in priority order: locked members read against this
// card; everything else reads against the last save's outcome for this row,
// falling back to a plain tick preview, falling back to its current card.
function CardAssignmentRow({
  row,
  here,
  checked,
  locked,
  onToggle,
  targetLabel,
  outcome,
}: RowProps): JSX.Element {
  const currentLabel = row.card
    ? `${ROTATION_BIN_LABELS[row.rotation_bin]} ${row.card.number}`
    : "No card";
  const title = `${row.artist_name ?? "Unknown artist"} — ${row.album_title ?? "Untitled"}`;
  const status = here ? (
    <Typography level="body-xs" textColor="text.tertiary">
      On {targetLabel}
    </Typography>
  ) : outcome?.ok ? (
    <Typography level="body-xs" color="success">
      Moved to {targetLabel}
    </Typography>
  ) : outcome && "notAttempted" in outcome ? (
    <Typography level="body-xs" color="neutral">
      Not attempted — still on {currentLabel}
    </Typography>
  ) : outcome ? (
    <Typography level="body-xs" color="danger">
      {rotationWriteErrorMessage(outcome.error, "Couldn't move this record.")}
    </Typography>
  ) : checked ? (
    <Typography level="body-xs" color="warning">
      {currentLabel} → {targetLabel}
    </Typography>
  ) : (
    <Typography level="body-xs" textColor="text.tertiary">
      {currentLabel}
    </Typography>
  );
  return (
    <Stack direction="row" spacing={1} alignItems="flex-start" sx={{ py: 0.5 }}>
      <Checkbox
        size="sm"
        checked={checked}
        disabled={here || locked}
        slotProps={{ input: { "aria-label": title } }}
        onChange={() => onToggle(row.rotation_id)}
      />
      <Stack sx={{ minWidth: 0 }}>
        <Typography level="body-sm">{title}</Typography>
        {status}
      </Stack>
    </Stack>
  );
}

/**
 * The Cards tab's re-carding tool: ticks a bin's active records onto the
 * open card. Presentational only -- every save belongs to
 * `useCardAssignmentSave(card.id)`, which owns `running`, `progress` and
 * `results`; this component holds nothing but which rows are ticked.
 *
 * Reads `getRotationList("active")`, never `status=all` -- the Cards tab
 * must not pay for the unbounded history read. Members are ticked and locked
 * (`here`); every other active row in the bin is tickable, and a tick
 * previews the move (`Heavy 1 → Heavy 3`).
 *
 * `locked` gates both ticking and Save/Retry, and covers the save itself
 * *and* the `status=active` refetch that follows it: a per-row write only
 * patches the `status=all` cache, so until that refetch lands, a record this
 * save just moved still reads here as elsewhere and would still be tickable.
 *
 * The Save/Retry control is one button: when every currently ticked record
 * the last save touched came back unresolved (failed or not attempted), and
 * nothing new has been ticked since, it resends exactly those via `retry()`;
 * otherwise it starts a fresh batch via `save()` with whatever is ticked now,
 * any such unresolved records included.
 */
export default function CardAssignmentPanel({
  card,
  onClose,
}: CardAssignmentPanelProps): JSX.Element {
  const binLabel = ROTATION_BIN_LABELS[card.bin];
  const cardLabel = `${binLabel} ${card.number}`;
  const { data, isFetching } = useGetRotationListQuery("active");
  const { running, progress, results, save, retry } = useCardAssignmentSave(card.id);
  const [tickedRowIds, setTickedRowIds] = useState<ReadonlySet<number>>(() => new Set());

  const locked = running || isFetching;
  const binRows = (data ?? []).filter((row) => row.rotation_bin === card.bin);
  const hereRows = binRows.filter((row) => row.card?.id === card.id);
  const elsewhereRows = binRows.filter((row) => row.card?.id !== card.id);

  const toggle = (rotationId: number) => {
    if (locked) return;
    setTickedRowIds((prev) => {
      const next = new Set(prev);
      if (next.has(rotationId)) next.delete(rotationId);
      else next.add(rotationId);
      return next;
    });
  };

  const moveIds = rotationRowsToMoveOntoCard(binRows, card, [...tickedRowIds]);
  // `retry()` is the hook's own blanket resend of every unresolved row from
  // the last save, with no way to narrow it -- so it is only safe to call
  // when the ticked set still names exactly that set. A row unticked since
  // (second-guessing a failure) must fall through to a fresh `save`, or
  // `retry()` would resend it against the tick that just took it back.
  const unresolvedCount = [...results.values()].filter((outcome) => !outcome.ok).length;
  const retryOnly =
    moveIds.length > 0 &&
    moveIds.length === unresolvedCount &&
    moveIds.every((id) => results.get(id)?.ok === false);
  const commit = () => void (retryOnly ? retry() : save(moveIds));

  return (
    <ConfirmDialog
      open
      onClose={onClose}
      pending={locked}
      title={cardLabel}
      sx={{ maxWidth: 560, width: "100%" }}
      actions={
        <Stack direction="row" spacing={1} sx={{ width: "100%", justifyContent: "flex-end" }}>
          <Button variant="plain" color="neutral" disabled={locked} onClick={onClose}>
            Close
          </Button>
          <Button variant="solid" disabled={locked || moveIds.length === 0} onClick={commit}>
            {retryOnly
              ? `Retry ${moveIds.length}`
              : moveIds.length > 0
                ? `Save ${moveIds.length}`
                : "Save"}
          </Button>
        </Stack>
      }
    >
      <Typography level="body-sm" sx={{ mb: 1.5 }}>
        Tick every record physically on {cardLabel}. Ticking a record from another card moves it
        here.
      </Typography>
      {running && (
        <Typography level="body-sm" role="status" sx={{ mb: 1 }}>
          Moving {progress.done} of {progress.total} to {cardLabel}…
        </Typography>
      )}
      <Typography level="title-sm" sx={{ mb: 0.5 }}>
        On {cardLabel} now · {hereRows.length}
      </Typography>
      <Stack spacing={0.25} sx={{ mb: 2 }}>
        {hereRows.map((row) => (
          <CardAssignmentRow
            key={row.rotation_id}
            row={row}
            here
            checked
            locked={locked}
            onToggle={toggle}
            targetLabel={cardLabel}
            outcome={undefined}
          />
        ))}
      </Stack>
      <Typography level="title-sm" sx={{ mb: 0.5 }}>
        Elsewhere in {binLabel} · {elsewhereRows.length}
      </Typography>
      <Stack spacing={0.25}>
        {elsewhereRows.map((row) => (
          <CardAssignmentRow
            key={row.rotation_id}
            row={row}
            here={false}
            checked={tickedRowIds.has(row.rotation_id)}
            locked={locked}
            onToggle={toggle}
            targetLabel={cardLabel}
            outcome={results.get(row.rotation_id)}
          />
        ))}
      </Stack>
    </ConfirmDialog>
  );
}
