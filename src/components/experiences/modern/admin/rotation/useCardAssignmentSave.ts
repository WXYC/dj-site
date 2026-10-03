"use client";

import { useRef, useState } from "react";
import { useAppDispatch } from "@/lib/hooks";
import {
  refetchRotationCardAssignments,
  useMoveRotationRowToCardMutation,
} from "@/lib/features/rotation/api";
import {
  moveRowsOntoCard,
  type CardMoveRowOutcome,
  type MoveRowsOntoCardOutcome,
} from "@/lib/features/rotation/moveRowsOntoCard";

type CardMoveResults = ReadonlyMap<number, CardMoveRowOutcome>;
type CardSave = {
  cardId: number;
  // The latest run's rows as a queue: a row whose move fails goes to the
  // back, so the rows that have not landed read least recently attempted
  // first.
  order: readonly number[];
  done: number;
  total: number;
  results: CardMoveResults;
};

const NO_RESULTS: CardMoveResults = new Map();

/**
 * Drives `moveRowsOntoCard` for the card-assignment panel's save, the way
 * `useAlbumRotationActions` drives `addThenRetire`: wires the per-row
 * mutation and the batch's one refetch into the loop, and holds the
 * running flag, progress, and per-record results as local state scoped to
 * the open panel, not Redux.
 *
 * `save` and `retry` resolve to the loop's outcome, so a caller knows
 * whether every move landed before it acts on that. `progress.done` counts
 * only rows the loop attempted -- a row the batch stopped before reaching
 * never advances it. `save` sends each row once: an id given again is
 * dropped, keeping its first place. A run with no rows resolves to an empty
 * outcome and changes nothing; a call made while a run is in flight is
 * ignored and resolves to `null`.
 *
 * `retry` resends every row that has not landed, least recently attempted
 * first, with the progress total reset to that count: the rows never sent,
 * in the order `save` was given them, then the rows that failed, oldest
 * attempt first. The rows are held as a queue to that end -- a row whose
 * move fails goes to the back. The order matters because a batch stops
 * after consecutive failures: rows the server refuses every time would
 * otherwise head every retry, stop it, and starve the rows behind them, a
 * row that failed once for a passing reason included.
 *
 * A stopped retry does not demote a row: one that failed earlier and was
 * not reached keeps its failed result and its last error, and only a row
 * never sent at all reads as not attempted. `results` can therefore differ
 * from that retry's own outcome, whose `notAttempted` names every row that
 * one run did not reach.
 *
 * A save belongs to the card it was started against, because the hook's
 * owner can stay mounted while `cardId` changes: its rows keep going to
 * that card, and `progress` and `results` are exposed only while `cardId`
 * is that card -- so `retry`, which reads them, can never move one card's
 * failed rows onto another.
 *
 * `running` covers the writes, not the refetch that follows them.
 */
export function useCardAssignmentSave(cardId: number) {
  const dispatch = useAppDispatch();
  const [moveRotationRowToCard] = useMoveRotationRowToCardMutation();
  const [running, setRunning] = useState(false);
  const [lastSave, setLastSave] = useState<CardSave | null>(null);
  // `running` is a render behind within the tick that starts a run, so a
  // second call in that tick can only be refused on a ref.
  const inFlight = useRef(false);
  // Kept current every render so `retry` reads the save as it stands when
  // it is called, not as it stood in the render that produced it.
  const lastSaveRef = useRef(lastSave);
  lastSaveRef.current = lastSave;

  const shown = lastSave?.cardId === cardId ? lastSave : null;
  const progress = { done: shown?.done ?? 0, total: shown?.total ?? 0 };
  const results = shown?.results ?? NO_RESULTS;

  const run = async (
    rotationIds: readonly number[],
    carried: CardMoveResults,
  ): Promise<MoveRowsOntoCardOutcome | null> => {
    if (inFlight.current) return null;
    if (rotationIds.length === 0) return { moved: [], failed: [], notAttempted: [] };
    inFlight.current = true;
    setRunning(true);
    setLastSave({
      cardId,
      order: rotationIds,
      done: 0,
      total: rotationIds.length,
      results: carried,
    });
    try {
      return await moveRowsOntoCard(
        rotationIds,
        (rotationId) => moveRotationRowToCard({ rotation_id: rotationId, card_id: cardId }).unwrap(),
        (rotationId, outcome) =>
          setLastSave(
            (prev) =>
              prev && {
                ...prev,
                order: outcome.ok
                  ? prev.order
                  : [...prev.order.filter((id) => id !== rotationId), rotationId],
                done: prev.done + 1,
                results: new Map(prev.results).set(rotationId, outcome),
              },
          ),
        ({ failed, notAttempted }) => {
          if (notAttempted.length > 0) {
            setLastSave(
              (prev) =>
                prev && {
                  ...prev,
                  results: notAttempted.reduce(
                    (results, rotationId) =>
                      results.has(rotationId)
                        ? results
                        : results.set(rotationId, { ok: false, notAttempted: true }),
                    new Map(prev.results),
                  ),
                },
            );
          }
          dispatch(refetchRotationCardAssignments({ anyRowFailed: failed.length > 0 }));
        },
      );
    } finally {
      inFlight.current = false;
      setRunning(false);
    }
  };

  const save = (rotationIds: readonly number[]) => run([...new Set(rotationIds)], NO_RESULTS);

  const retry = () => {
    const current = lastSaveRef.current?.cardId === cardId ? lastSaveRef.current : null;
    return run(
      (current?.order ?? []).filter((rotationId) => !current?.results.get(rotationId)?.ok),
      current?.results ?? NO_RESULTS,
    );
  };

  return { running, progress, results, save, retry };
}
