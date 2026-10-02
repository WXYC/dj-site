"use client";

import { useState } from "react";
import { useAppDispatch } from "@/lib/hooks";
import {
  refetchRotationCardAssignments,
  useMoveRotationRowToCardMutation,
} from "@/lib/features/rotation/api";
import { moveRowsOntoCard, type CardMoveRowOutcome } from "@/lib/features/rotation/moveRowsOntoCard";

/**
 * Drives `moveRowsOntoCard` for the card-assignment panel's save, the way
 * `useAlbumRotationActions` drives `addThenRetire`: wires the per-row
 * mutation and the batch's one refetch into the loop, and holds the
 * running flag, progress, and per-record results as local state scoped to
 * the open panel, not Redux. `retry` resends only the rows `results` still
 * marks failed, with the progress total reset to that count.
 */
export function useCardAssignmentSave(cardId: number) {
  const dispatch = useAppDispatch();
  const [moveRotationRowToCard] = useMoveRotationRowToCardMutation();
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [results, setResults] = useState<Map<number, CardMoveRowOutcome>>(() => new Map());

  const run = async (rotationIds: readonly number[]) => {
    setRunning(true);
    setProgress({ done: 0, total: rotationIds.length });
    try {
      await moveRowsOntoCard(
        rotationIds,
        (rotationId) => moveRotationRowToCard({ rotation_id: rotationId, card_id: cardId }).unwrap(),
        (rotationId, outcome) => {
          setResults((prev) => new Map(prev).set(rotationId, outcome));
          setProgress((prev) => ({ ...prev, done: prev.done + 1 }));
        },
        () => dispatch(refetchRotationCardAssignments()),
      );
    } finally {
      setRunning(false);
    }
  };

  const save = (rotationIds: readonly number[]) => {
    setResults(new Map());
    return run(rotationIds);
  };

  const retry = () => {
    const failedIds = [...results]
      .filter(([, outcome]) => !outcome.ok)
      .map(([rotationId]) => rotationId);
    return run(failedIds);
  };

  return { running, progress, results, save, retry };
}
