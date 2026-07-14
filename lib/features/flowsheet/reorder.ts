import type { FlowsheetEntry } from "./types";

/**
 * Given the pre-drag order (`snapshot`) and the dropped order (`finalOrder`)
 * of the current show's entries, compute the `new_position` to send to
 * `PATCH /play-order` for the dragged entry — or null when the drag was a
 * no-op (or the entry can't be found in either array).
 *
 * The server moves the entry to `new_position` and renumbers the block in
 * between, so the target is the play_order held pre-drag by whichever entry
 * occupied the drop slot. Both arrays include non-draggable marker rows —
 * they shift like everything else when the server renumbers, so they must
 * count in the index math.
 */
export function computeDragTarget(
  snapshot: FlowsheetEntry[],
  finalOrder: FlowsheetEntry[],
  entryId: number
): number | null {
  const oldIndex = snapshot.findIndex((e) => e.id === entryId);
  const newIndex = finalOrder.findIndex((e) => e.id === entryId);
  if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) {
    return null;
  }
  return snapshot[newIndex].play_order;
}
