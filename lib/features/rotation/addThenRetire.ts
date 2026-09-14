/** One retire that was attempted and refused; the entry is still active. */
export type RetireFailure = { rotationId: number; error: unknown };

export type AddThenRetireOutcome =
  /** The add was refused, so no retire was ever attempted: nothing changed. */
  | { step: "add-failed"; error: unknown }
  /**
   * The add (when one was requested) landed; `retireFailures` lists any
   * prior entries that are still active despite being asked to retire.
   */
  | { step: "done"; added: boolean; retireFailures: RetireFailure[] };

/**
 * The one ordering for a rotation write that replaces entries: the add lands
 * first, and only then are the prior entries retired. The two orders fail
 * differently and only this one fails safe — retiring first and then failing
 * the add leaves the release in no bin at all, invisible behind a generic
 * error and gone from the flowsheet rotation picker DJs use on air, while
 * adding first and then failing a retire leaves it in more than one bin,
 * which the consuming surfaces render explicitly, so the state is visible
 * and recoverable. Shared by the catalog classify gesture and the admin
 * list's bin move so no caller re-derives (and accidentally reverses) the
 * two halves.
 *
 * `add` is `null` for a pure removal — a clear retires without adding.
 * Every retire is attempted even after one fails: stopping at the first
 * rejection would leave later entries active, unattempted, and unreported.
 * Rejections never escape; callers branch on the returned outcome.
 */
export async function addThenRetire(
  add: (() => Promise<unknown>) | null,
  retireIds: readonly number[],
  retire: (rotationId: number) => Promise<unknown>,
): Promise<AddThenRetireOutcome> {
  if (add != null) {
    try {
      await add();
    } catch (error) {
      return { step: "add-failed", error };
    }
  }
  const retireFailures: RetireFailure[] = [];
  for (const rotationId of retireIds) {
    try {
      await retire(rotationId);
    } catch (error) {
      retireFailures.push({ rotationId, error });
    }
  }
  return { step: "done", added: add != null, retireFailures };
}
