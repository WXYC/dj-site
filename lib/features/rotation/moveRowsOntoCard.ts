/** How many move rejections in a row stop the batch. A success resets the count. */
export const CONSECUTIVE_FAILURE_STOP_THRESHOLD = 3;

/** The outcome `onRowSettled` reports for a single row as it lands. */
export type CardMoveRowOutcome =
  | { ok: true }
  | { ok: false; error: unknown }
  | { ok: false; notAttempted: true };

export type MoveRowsOntoCardOutcome = {
  moved: number[];
  failed: { rotationId: number; error: unknown }[];
  notAttempted: number[];
};

/**
 * Moves rows onto a card one at a time, in the style of `addThenRetire`:
 * `onRowSettled` fires once per attempted row in order as it lands, and
 * `settle` fires exactly once, after the batch ends, with its outcome --
 * the one refetch point. Imports nothing from React or RTK.
 *
 * The batch stops once `CONSECUTIVE_FAILURE_STOP_THRESHOLD` moves have
 * failed in a row; a success resets that count. Rows the stop leaves behind
 * are never passed to `move`, and are named in `notAttempted` instead --
 * `onRowSettled` never fires for them.
 *
 * A rejection from `move` never escapes: it becomes that row's failed
 * outcome. `onRowSettled` is the caller's responsibility and runs outside
 * that guard, so a throw from it stops the loop and rejects the returned
 * promise -- catching it would report a row whose write had landed as
 * failed, and a retry built on that report would resend it. `settle` still
 * fires exactly once in that case, with the rows left behind named in
 * `notAttempted`, so a batch that already moved rows before the throw is
 * still refetched; the throw itself still propagates after `settle` runs.
 */
export async function moveRowsOntoCard(
  rotationIds: readonly number[],
  move: (rotationId: number) => Promise<unknown>,
  onRowSettled: (rotationId: number, outcome: CardMoveRowOutcome) => void,
  settle: (outcome: MoveRowsOntoCardOutcome) => void,
): Promise<MoveRowsOntoCardOutcome> {
  const outcome: MoveRowsOntoCardOutcome = { moved: [], failed: [], notAttempted: [] };
  let consecutiveFailures = 0;
  let index = 0;
  try {
    for (; index < rotationIds.length; index++) {
      const rotationId = rotationIds[index];
      let rowOutcome: CardMoveRowOutcome = { ok: true };
      try {
        await move(rotationId);
        outcome.moved.push(rotationId);
        consecutiveFailures = 0;
      } catch (error) {
        outcome.failed.push({ rotationId, error });
        rowOutcome = { ok: false, error };
        consecutiveFailures += 1;
      }
      onRowSettled(rotationId, rowOutcome);
      if (consecutiveFailures >= CONSECUTIVE_FAILURE_STOP_THRESHOLD) break;
    }
  } finally {
    outcome.notAttempted.push(...rotationIds.slice(index + 1));
    settle(outcome);
  }
  return outcome;
}
