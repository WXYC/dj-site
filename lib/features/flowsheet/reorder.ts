import type { FlowsheetEntry } from "./types";

/**
 * Compute the `new_position` for `PATCH /play-order` from the pre-drag order
 * and the dropped order — null when the drag was a no-op. The server moves
 * the entry to `new_position` and renumbers the block in between, so the
 * target is the play_order held pre-drag by whichever entry occupied the
 * drop slot. Both arrays must include non-draggable marker rows: the server
 * renumbers across every entry type.
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
