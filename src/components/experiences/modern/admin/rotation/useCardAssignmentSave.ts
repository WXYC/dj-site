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
type CardSave = { cardId: number; done: number; total: number; results: CardMoveResults };

const NO_RESULTS: CardMoveResults = new Map();

/**
 * Drives `moveRowsOntoCard` for the card-assignment panel's save, the way
 * `useAlbumRotationActions` drives `addThenRetire`: wires the per-row
 * mutation and the batch's one refetch into the loop, and holds the
 * running flag, progress, and per-record results as local state scoped to
 * the open panel, not Redux.
 *
 * `save` and `retry` resolve to the loop's outcome, so a caller knows
 * whether every move landed before it acts on that. `retry` resends only the
 * rows `results` marks failed, with the progress total reset to that count.
 * A run with no rows resolves to an empty outcome and changes nothing; a
 * call made while a run is in flight is ignored and resolves to `null`.
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

  const shown = lastSave?.cardId === cardId ? lastSave : null;
  const progress = { done: shown?.done ?? 0, total: shown?.total ?? 0 };
  const results = shown?.results ?? NO_RESULTS;

  const run = async (
    rotationIds: readonly number[],
    carried: CardMoveResults,
  ): Promise<MoveRowsOntoCardOutcome | null> => {
    if (inFlight.current) return null;
    if (rotationIds.length === 0) return { moved: [], failed: [] };
    inFlight.current = true;
    setRunning(true);
    setLastSave({ cardId, done: 0, total: rotationIds.length, results: carried });
    try {
      return await moveRowsOntoCard(
        rotationIds,
        (rotationId) => moveRotationRowToCard({ rotation_id: rotationId, card_id: cardId }).unwrap(),
        (rotationId, outcome) =>
          setLastSave(
            (prev) =>
              prev && {
                ...prev,
                done: prev.done + 1,
                results: new Map(prev.results).set(rotationId, outcome),
              },
          ),
        ({ failed }) =>
          dispatch(refetchRotationCardAssignments({ anyRowFailed: failed.length > 0 })),
      );
    } finally {
      inFlight.current = false;
      setRunning(false);
    }
  };

  const save = (rotationIds: readonly number[]) => run(rotationIds, NO_RESULTS);

  const retry = () =>
    run(
      [...results].filter(([, outcome]) => !outcome.ok).map(([rotationId]) => rotationId),
      results,
    );

  return { running, progress, results, save, retry };
}
