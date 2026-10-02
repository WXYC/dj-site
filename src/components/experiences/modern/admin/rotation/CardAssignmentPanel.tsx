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
import { Alert, Button, Checkbox, LinearProgress, Stack, Typography } from "@mui/joy";
import { useCardAssignmentSave } from "./useCardAssignmentSave";

export type CardAssignmentPanelProps = { card: RotationCard; onClose: () => void };

type RowProps = {
  row: RotationListRow;
  here: boolean;
  checked: boolean;
  disabled: boolean;
  onToggle: (rotationId: number) => void;
  targetLabel: string;
  outcome: CardMoveRowOutcome | undefined;
};

// A row's status line, in priority order: members read against this card;
// everything else reads against the last save's outcome for this row,
// falling back to a plain tick preview, falling back to its current card.
// The line is the checkbox's description, so it is read out with the record.
function CardAssignmentRow({
  row,
  here,
  checked,
  disabled,
  onToggle,
  targetLabel,
  outcome,
}: RowProps): JSX.Element {
  const currentLabel = row.card
    ? `${ROTATION_BIN_LABELS[row.rotation_bin]} ${row.card.number}`
    : "No card";
  const statusId = `card-assignment-status-${row.rotation_id}`;
  const [status, color] = here
    ? [`On ${targetLabel}`, undefined]
    : outcome?.ok
      ? [`Moved to ${targetLabel}`, "success" as const]
      : outcome && "notAttempted" in outcome
        ? [`Not attempted — still on ${currentLabel}`, "neutral" as const]
        : outcome
          ? [
              rotationWriteErrorMessage(outcome.error, "Couldn't move this record."),
              "danger" as const,
            ]
          : checked
            ? [`${currentLabel} → ${targetLabel}`, "warning" as const]
            : [currentLabel, undefined];
  return (
    <Stack sx={{ py: 0.5 }}>
      <Checkbox
        size="sm"
        label={`${row.artist_name ?? "Unknown artist"} — ${row.album_title ?? "Untitled"}`}
        checked={checked}
        disabled={disabled}
        slotProps={{ input: { "aria-describedby": statusId } }}
        onChange={() => onToggle(row.rotation_id)}
      />
      <Typography
        id={statusId}
        level="body-xs"
        color={color}
        textColor={color ? undefined : "text.tertiary"}
        sx={{ pl: 3.5 }}
      >
        {status}
      </Typography>
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
 * That read is a write precondition, so it fails closed, at two levels. A
 * per-row write only patches the `status=all` cache, so a record this save
 * just moved still reads here as elsewhere until the refetch after the save
 * shows it on the card. The panel lock (`locked`) refuses ticking and
 * Save/Retry while a save runs, while the read is fetching, and while it is
 * in error; an unknown or failed read renders as loading or as an error
 * with Retry, never as an empty bin. The row lock does not depend on how
 * that refetch ends, or on whether it has started: a row whose last outcome
 * is moved stays ticked and disabled for as long as the list shows it
 * elsewhere, and is never among the ids a save sends.
 *
 * Only a running save blocks closing: a read in flight writes nothing.
 *
 * The Save/Retry control is one button. It resends through `retry()` only
 * when the ticked records still to move are exactly the records the last
 * save left unresolved (failed or not attempted): none of those unticked,
 * none besides them ticked. Anything else starts a fresh batch through
 * `save()` with the ticked records still to move.
 */
export default function CardAssignmentPanel({
  card,
  onClose,
}: CardAssignmentPanelProps): JSX.Element {
  const binLabel = ROTATION_BIN_LABELS[card.bin];
  const cardLabel = `${binLabel} ${card.number}`;
  const { data, isFetching, isError, refetch } = useGetRotationListQuery("active");
  const { running, progress, results, save, retry } = useCardAssignmentSave(card.id);
  const [tickedRowIds, setTickedRowIds] = useState<ReadonlySet<number>>(() => new Set());

  const locked = running || isFetching || isError;
  const binRows = (data ?? []).filter((row) => row.rotation_bin === card.bin);
  const hereRows = binRows.filter((row) => row.card?.id === card.id);
  const elsewhereRows = binRows.filter((row) => row.card?.id !== card.id);
  const moved = (rotationId: number) => results.get(rotationId)?.ok === true;

  const toggle = (rotationId: number) => {
    if (locked) return;
    setTickedRowIds((prev) => {
      const next = new Set(prev);
      if (next.has(rotationId)) next.delete(rotationId);
      else next.add(rotationId);
      return next;
    });
  };

  const moveIds = rotationRowsToMoveOntoCard(binRows, card, [...tickedRowIds]).filter(
    (rotationId) => !moved(rotationId),
  );
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
      pending={running}
      role="dialog"
      title={cardLabel}
      titleId="card-assignment-title"
      sx={{ maxWidth: 560, width: "100%" }}
      actions={
        <Stack direction="row" spacing={1} sx={{ width: "100%", justifyContent: "flex-end" }}>
          <Button variant="plain" color="neutral" disabled={running} onClick={onClose}>
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
      {isError && (
        <Alert color="danger" sx={{ justifyContent: "space-between", mb: 1 }}>
          <Typography>Could not load the rotation list.</Typography>
          <Button variant="outlined" color="danger" size="sm" onClick={() => void refetch()}>
            Retry
          </Button>
        </Alert>
      )}
      {data == null ? (
        !isError && <LinearProgress aria-label="Loading rotation" />
      ) : (
        <>
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
                disabled
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
                checked={moved(row.rotation_id) || tickedRowIds.has(row.rotation_id)}
                disabled={locked || moved(row.rotation_id)}
                onToggle={toggle}
                targetLabel={cardLabel}
                outcome={results.get(row.rotation_id)}
              />
            ))}
          </Stack>
        </>
      )}
    </ConfirmDialog>
  );
}
