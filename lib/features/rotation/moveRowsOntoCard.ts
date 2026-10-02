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
 * after the last row, with the batch's outcome -- the one refetch point.
 * Imports nothing from React or RTK.
 *
 * A rejection from `move` never escapes: it becomes that row's failed
 * outcome. The two callbacks are the caller's responsibility and run outside
 * that guard, so a throw from either stops the loop and rejects the returned
 * promise. Catching it would report a row whose write had landed as failed,
 * and a retry built on that report would resend it.
 */
export async function moveRowsOntoCard(
  rotationIds: readonly number[],
  move: (rotationId: number) => Promise<unknown>,
  onRowSettled: (rotationId: number, outcome: CardMoveRowOutcome) => void,
  settle: (outcome: MoveRowsOntoCardOutcome) => void,
): Promise<MoveRowsOntoCardOutcome> {
  const outcome: MoveRowsOntoCardOutcome = { moved: [], failed: [] };
  for (const rotationId of rotationIds) {
    let rowOutcome: CardMoveRowOutcome = { ok: true };
    try {
      await move(rotationId);
      outcome.moved.push(rotationId);
    } catch (error) {
      outcome.failed.push({ rotationId, error });
      rowOutcome = { ok: false, error };
    }
    onRowSettled(rotationId, rowOutcome);
  }
  settle(outcome);
  return outcome;
}
