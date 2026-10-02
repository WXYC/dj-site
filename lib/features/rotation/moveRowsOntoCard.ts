/** The outcome `onRowSettled` reports for a single row as it lands. */
export type CardMoveRowOutcome = { ok: true } | { ok: false; error: unknown };

export type MoveRowsOntoCardOutcome = {
  moved: number[];
  failed: { rotationId: number; error: unknown }[];
};

/**
 * Moves rows onto a card one at a time, in the style of `addThenRetire`:
 * every row is attempted even after an earlier one fails, `onRowSettled`
 * fires once per row in order as it lands, and `settle` fires exactly once,
 * after the last row -- the one refetch point. Rejections never escape.
 * Imports nothing from React or RTK.
 */
export async function moveRowsOntoCard(
  rotationIds: readonly number[],
  move: (rotationId: number) => Promise<unknown>,
  onRowSettled: (rotationId: number, outcome: CardMoveRowOutcome) => void,
  settle: () => void,
): Promise<MoveRowsOntoCardOutcome> {
  const moved: number[] = [];
  const failed: MoveRowsOntoCardOutcome["failed"] = [];
  for (const rotationId of rotationIds) {
    try {
      await move(rotationId);
      moved.push(rotationId);
      onRowSettled(rotationId, { ok: true });
    } catch (error) {
      failed.push({ rotationId, error });
      onRowSettled(rotationId, { ok: false, error });
    }
  }
  settle();
  return { moved, failed };
}
