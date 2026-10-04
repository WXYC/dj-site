"use client";

import type { JSX } from "react";
import { useState } from "react";
import type { RotationCard } from "@wxyc/shared";
import { useGetRotationListQuery } from "@/lib/features/rotation/api";
import {
  narrowCardAssignmentRows,
  rotationCardName,
  rotationRecordLabel,
  rotationRowsToMoveOntoCard,
} from "@/lib/features/rotation/cards";
import type {
  CardMoveRowOutcome,
  MoveRowsOntoCardOutcome,
} from "@/lib/features/rotation/moveRowsOntoCard";
import { ROTATION_BIN_LABELS, type RotationListRow } from "@/lib/features/rotation/types";
import { rotationWriteErrorMessage } from "@/lib/features/rotation/writeErrorMessage";
import ConfirmDialog from "@/src/components/experiences/modern/ConfirmDialog";
import ReadRetryAlert from "@/src/components/experiences/modern/admin/ReadRetryAlert";
import { Button, Checkbox, Input, LinearProgress, Stack, Typography } from "@mui/joy";
import { useCardAssignmentSave } from "./useCardAssignmentSave";

export type CardAssignmentPanelProps = {
  card: RotationCard;
  onClose: () => void;
  /**
   * The bin's next card and how to open it, absent on the bin's last card —
   * gates Save & open. One prop carrying both rather than two independent
   * ones, so a caller cannot wire up a next card with no way to open it.
   */
  next?: { card: RotationCard; open: () => void };
  /**
   * The "Still on `<Bin>` 1" toggle, lifted to `CardsManager` so it survives
   * Save & open's remount -- a prop, not local state, is what persists it.
   */
  stillOnFirstCardOnly: boolean;
  setStillOnFirstCardOnly: (value: boolean) => void;
};

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
    ? rotationCardName(row.rotation_bin, row.card.number)
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
        label={rotationRecordLabel(row)}
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
 * `results`; this component holds only the tick set and the search text.
 * The "Still on `<Bin>` 1" toggle is `CardsManager`'s, beside
 * `assigningCardId`, passed down as a prop -- it is what survives advancing
 * to the next card. Advancing remounts the panel (`CardsManager` keys it by
 * card id), which resets the tick set and the search text, nothing else.
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
 * that refetch ends, or on whether it has started: a row the last save or
 * its retries moved shows ticked and disabled for as long as the list shows
 * it elsewhere, and is left out of the ids sent. It lasts only as long as
 * those results do. A later fresh save replaces them, and a record an
 * earlier save moved that the list still shows on its old card then reads
 * unticked: it is sent again only if it is ticked again.
 *
 * Only a running save blocks closing: a read in flight writes nothing.
 *
 * The Save/Retry control is one button. It resends through `retry()` only
 * when the ticked records still to move are exactly the records the last
 * save left unresolved (failed or not attempted): none of those unticked,
 * none besides them ticked. Anything else starts a fresh batch through
 * `save()` with the ticked records still to move.
 *
 * The search box narrows both sections; the "Still on `<Bin>` 1" toggle
 * narrows elsewhere only (`narrowCardAssignmentRows`) -- a tick survives
 * being filtered out of either, since `moveIds` below reads the tick set
 * against the un-narrowed `binRows`, and the footer names any ticked row
 * search or the toggle has hidden from view. Save & open advances via
 * `next.open()` only once the save's own outcome names no failed and no
 * not-attempted row; it never waits for the refetch that follows, so the
 * panel lock above -- not a row lock, which a remount drops with the ticks --
 * is what keeps card N+1's list from being ticked against a read that still
 * shows the just-moved records elsewhere. With nothing ticked and a next
 * card, the control reads "Open" instead and sends nothing: a walk through
 * cards already correct needs no save, only `next.open()`, gated solely by
 * `running` since no write is at stake.
 */
export default function CardAssignmentPanel({
  card,
  onClose,
  next,
  stillOnFirstCardOnly,
  setStillOnFirstCardOnly,
}: CardAssignmentPanelProps): JSX.Element {
  const binLabel = ROTATION_BIN_LABELS[card.bin];
  const cardLabel = rotationCardName(card.bin, card.number);
  const firstCardLabel = rotationCardName(card.bin, 1);
  const nextCardLabel = next ? rotationCardName(next.card.bin, next.card.number) : null;
  const { data, isFetching, isError, refetch } = useGetRotationListQuery("active");
  const { running, progress, results, save, retry } = useCardAssignmentSave(card.id);
  const [tickedRowIds, setTickedRowIds] = useState<ReadonlySet<number>>(() => new Set());
  const [search, setSearch] = useState("");

  const locked = running || isFetching || isError;
  const binRows = (data ?? []).filter((row) => row.rotation_bin === card.bin);
  const { here, elsewhere } = narrowCardAssignmentRows(binRows, card, {
    search,
    stillOnFirstCardOnly,
  });
  const moved = (rotationId: number) => results.get(rotationId)?.ok === true;

  const toggle = (rotationId: number) => {
    if (locked) return;
    setTickedRowIds((prev) => {
      const nextTicked = new Set(prev);
      if (nextTicked.has(rotationId)) nextTicked.delete(rotationId);
      else nextTicked.add(rotationId);
      return nextTicked;
    });
  };

  const moveIds = rotationRowsToMoveOntoCard(binRows, card, [...tickedRowIds]).filter(
    (rotationId) => !moved(rotationId),
  );
  // Ticked rows the current search/filter has hidden from view -- still
  // counted in `moveIds` above, so the label says so rather than letting a
  // narrowed list look like it undercounts what Save will actually send.
  const hiddenCount = moveIds.filter(
    (rotationId) => !elsewhere.some((row) => row.rotation_id === rotationId),
  ).length;
  const hiddenSuffix = hiddenCount > 0 ? ` (${hiddenCount} hidden)` : "";
  // Not gated on `data != null`: the Open step this feeds sends nothing
  // either way, so a read still loading or one that failed is no different
  // from a read that landed and found nothing to move -- all three read
  // "nothing to save" here, and `running` alone is what disables Open.
  const nothingToSave = moveIds.length === 0;
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
  // A record that moved gives up its tick: its row lock lives in `results`,
  // which the next fresh save replaces, and a tick left behind would then be
  // counted and sent again from a list that still showed its old card.
  const dropMovedTicks = (outcome: MoveRowsOntoCardOutcome | null) =>
    setTickedRowIds((prev) => new Set([...prev].filter((id) => !outcome?.moved.includes(id))));
  const commit = () => void (retryOnly ? retry() : save(moveIds)).then(dropMovedTicks);
  // Never offered mid-retry -- a stopped batch's failures want Retry, not a
  // fresh save that would also carry the walk forward past them.
  const commitAndAdvance = () =>
    void save(moveIds).then((outcome) => {
      dropMovedTicks(outcome);
      if (next && outcome && outcome.failed.length === 0 && outcome.notAttempted.length === 0) {
        next.open();
      }
    });

  // All three dismissal routes (the Close button, the backdrop, and Escape)
  // share this one path -- ConfirmDialog's `onClose` already covers the
  // latter two, and the Close button calls it directly below. Counts
  // `moveIds`, not the tick set: a ticked record the active read no longer
  // carries (killed elsewhere) is nothing Save could send, so it must not
  // prompt for a move that cannot be seen or saved.
  const requestClose = () => {
    if (moveIds.length === 0) {
      onClose();
      return;
    }
    const count = moveIds.length;
    if (confirm(`Discard ${count} unsaved move${count === 1 ? "" : "s"}?`)) onClose();
  };

  return (
    <ConfirmDialog
      open
      onClose={requestClose}
      pending={running}
      role="dialog"
      title={cardLabel}
      titleId="card-assignment-title"
      sx={{ maxWidth: 560, width: "100%" }}
      actions={
        <Stack direction="row" spacing={1} sx={{ width: "100%", justifyContent: "flex-end" }}>
          <Button variant="plain" color="neutral" disabled={running} onClick={requestClose}>
            Close
          </Button>
          <Button variant="solid" disabled={locked || moveIds.length === 0} onClick={commit}>
            {retryOnly
              ? `Retry ${moveIds.length}`
              : moveIds.length > 0
                ? `Save ${moveIds.length}${hiddenSuffix}`
                : "Save"}
          </Button>
          {next && nothingToSave && (
            <Button variant="solid" disabled={running} onClick={next.open}>
              Open {nextCardLabel} <span aria-hidden="true">→</span>
            </Button>
          )}
          {next && !retryOnly && !nothingToSave && (
            <Button variant="solid" disabled={locked} onClick={commitAndAdvance}>
              Save & open {nextCardLabel}
              {hiddenSuffix} <span aria-hidden="true">→</span>
            </Button>
          )}
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
        <ReadRetryAlert
          message="Could not load the rotation list."
          onRetry={() => void refetch()}
          sx={{ mb: 1 }}
        />
      )}
      {data == null ? (
        !isError && <LinearProgress aria-label="Loading rotation" />
      ) : (
        <>
          <Typography level="title-sm" sx={{ mb: 0.5 }}>
            On {cardLabel} now · {here.length}
          </Typography>
          <Stack spacing={0.25} sx={{ mb: 2 }}>
            {here.map((row) => (
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
          <Stack direction="row" spacing={1.5} sx={{ mb: 1, alignItems: "center", flexWrap: "wrap" }}>
            <Input
              size="sm"
              type="search"
              placeholder={`Search ${binLabel}…`}
              aria-label={`Search ${binLabel}`}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              sx={{ flex: 1, minWidth: 160 }}
            />
            {card.number !== 1 && (
              <Checkbox
                size="sm"
                label={`Still on ${firstCardLabel}`}
                checked={stillOnFirstCardOnly}
                onChange={(event) => setStillOnFirstCardOnly(event.target.checked)}
              />
            )}
          </Stack>
          <Typography level="title-sm" sx={{ mb: 0.5 }}>
            {stillOnFirstCardOnly ? `Still on ${firstCardLabel}` : `Elsewhere in ${binLabel}`} ·{" "}
            {elsewhere.length}
          </Typography>
          <Stack spacing={0.25}>
            {elsewhere.map((row) => (
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
