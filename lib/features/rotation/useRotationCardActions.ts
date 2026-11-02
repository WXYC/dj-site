"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  useAddRotationCardMutation,
  useDeleteRotationCardMutation,
  useUpdateRotationCardMutation,
} from "@/lib/features/rotation/api";
import {
  rotationCardDeleteConflictMessage,
  rotationCardDeleteConflictReason,
  rotationCardName,
} from "@/lib/features/rotation/cards";
import { ROTATION_BIN_LABELS, type RotationBin } from "@/lib/features/rotation/types";
import { rotationWriteErrorMessage } from "@/lib/features/rotation/writeErrorMessage";
import { isUnmessagedHttpError } from "@/lib/rtk-query-error-logger";

/**
 * Card rename, delete, and add, with the per-card and per-add in-flight state
 * every card surface disables against. The card's number is never computed
 * here: the server assigns max+1 on add, and the number a new card shows is
 * whatever the mutation returned.
 */
export function useRotationCardActions() {
  const [addRotationCard] = useAddRotationCardMutation();
  const [updateRotationCard] = useUpdateRotationCardMutation();
  const [deleteRotationCard] = useDeleteRotationCardMutation();
  const [pendingCardIds, setPendingCardIds] = useState<ReadonlySet<number>>(() => new Set());
  const [pendingAddBin, setPendingAddBin] = useState<RotationBin | null>(null);

  const withPendingCard = async (cardId: number, run: () => Promise<unknown>) => {
    setPendingCardIds((prev) => new Set(prev).add(cardId));
    try {
      await run();
    } finally {
      setPendingCardIds((prev) => {
        const next = new Set(prev);
        next.delete(cardId);
        return next;
      });
    }
  };

  const renameCard = (cardId: number, name: string | null) =>
    void withPendingCard(cardId, async () => {
      try {
        await updateRotationCard({ id: cardId, name }).unwrap();
      } catch (err) {
        // The rename's refusals reach the shared middleware's toast; only
        // the shapes it stays silent about are this surface's to report.
        if (isUnmessagedHttpError(err)) {
          toast.error("Couldn't rename this card. Please try again.");
        }
      }
    });

  const deleteCard = (cardId: number) =>
    void withPendingCard(cardId, async () => {
      try {
        await deleteRotationCard(cardId).unwrap();
      } catch (err) {
        // The delete's rejections are wrapped out of the middleware, so this
        // is the one reporter: the guard 409's typed reason gets its own
        // sentence, everything else the server's message or the fallback.
        const reason = rotationCardDeleteConflictReason(err);
        toast.error(
          reason != null
            ? rotationCardDeleteConflictMessage(reason)
            : rotationWriteErrorMessage(err, "Couldn't delete this card. Please try again."),
        );
      }
    });

  const addCard = (bin: RotationBin) =>
    void (async () => {
      setPendingAddBin(bin);
      try {
        const created = await addRotationCard({ bin }).unwrap();
        // The server's assignment, echoed — never a locally computed max+1.
        toast.success(`Added ${rotationCardName(bin, created.number)}.`);
      } catch (err) {
        if (isUnmessagedHttpError(err)) {
          toast.error(
            `Couldn't add a card to ${ROTATION_BIN_LABELS[bin]}. Please try again.`,
          );
        }
      } finally {
        setPendingAddBin(null);
      }
    })();


  return { pendingCardIds, pendingAddBin, renameCard, deleteCard, addCard };
}
