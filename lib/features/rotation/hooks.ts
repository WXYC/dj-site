"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useKillRotationEntryMutation, useUpdateRotationRowMutation } from "./api";
import { rotationWriteErrorMessage } from "./writeErrorMessage";
import { isUnmessagedHttpError } from "@/lib/rtk-query-error-logger";

/**
 * The rotation lists' per-row write actions — Kill, Unkill, and the
 * within-bin card move — with one owner for the per-row in-flight set and
 * for the failure triage both list surfaces (the classic release list and
 * the modern admin list) must agree on.
 *
 * The triage rule is which failures the shared rejected-query middleware
 * toasts versus which the caller must toast itself, and it turns on whether
 * an endpoint carries `transformErrorResponse: wrapRotationWriteError`.
 * Kill's refusals reach the middleware's toast, so only the shapes it stays
 * silent about are this hook's to report. The field editor's (unkill, card
 * moves) are wrapped out of that lookup, which reads as unmessaged here
 * every time and puts the server's own sentence in the toast instead of a
 * generic one — the same refusal, reported once either way.
 *
 * `withPending` is returned so a list surface with a per-row write of its
 * own — the admin list's cross-bin move, which no endpoint expresses and so
 * cannot live here — registers that write in the same in-flight set and
 * behind the same failure triage, rather than owning a second set the row
 * would have to read separately.
 */
export function useRotationRowActions() {
  const [killRotationEntry] = useKillRotationEntryMutation();
  const [updateRotationRow] = useUpdateRotationRowMutation();
  const [pendingRotationIds, setPendingRotationIds] = useState<ReadonlySet<number>>(
    () => new Set(),
  );

  const withPending = async (
    rotationId: number,
    run: () => Promise<unknown>,
    failureVerb: string,
  ) => {
    setPendingRotationIds((prev) => new Set(prev).add(rotationId));
    try {
      await run();
    } catch (err) {
      if (isUnmessagedHttpError(err)) {
        toast.error(
          rotationWriteErrorMessage(
            err,
            `Couldn't ${failureVerb} this rotation release. Please try again.`,
          ),
        );
      }
    } finally {
      setPendingRotationIds((prev) => {
        const next = new Set(prev);
        next.delete(rotationId);
        return next;
      });
    }
  };

  // No kill_date on the kill: the server stamps CURRENT_DATE in the
  // database's own timezone, avoiding the browser's UTC-tomorrow problem.
  const kill = (rotationId: number) =>
    withPending(rotationId, () => killRotationEntry({ rotation_id: rotationId }).unwrap(), "kill");

  const unkill = (rotationId: number) =>
    withPending(
      rotationId,
      () => updateRotationRow({ rotation_id: rotationId, kill_date: null }).unwrap(),
      "unkill",
    );

  const moveToCard = (rotationId: number, cardId: number) =>
    withPending(
      rotationId,
      () => updateRotationRow({ rotation_id: rotationId, card_id: cardId }).unwrap(),
      "move",
    );

  return { pendingRotationIds, kill, unkill, moveToCard, withPending };
}
