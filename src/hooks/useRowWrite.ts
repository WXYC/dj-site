import { useEffect, useRef, useState } from "react";

type RowWriteOptions<Action extends string> = {
  /**
   * Re-reads every list the screen renders, one promise per list. Dispatch
   * `api.endpoints.<query>.initiate(arg, { subscribe: false, forceRefetch: true })`
   * with the same `arg` the screen's query hook uses, so the reload reaches the
   * same cache entry. Not the hook's `refetch()`, which throws once the page
   * has unmounted.
   */
  reload: () => Promise<unknown>[];
  /** True for the rejection that means someone else got there first. A lost race is a notice, not an error. */
  isLostRace: (err: unknown) => boolean;
  /** Any other rejection. Called as soon as the write fails, before the reload. Never called after unmount. */
  onFailure: (err: unknown, id: number, action: Action) => void;
  /** The lost-race notice; omit it for a screen where the reloaded list says so itself. Called after the reload, never after unmount. */
  onLostRace?: (id: number, action: Action) => void;
};

/**
 * One write per row at a time, and the row stays locked until every list it
 * renders has reloaded. A failed write or a lost race changes the lists too,
 * so every outcome reloads before the row unlocks.
 *
 * `write(id, action, run)` ignores a call on a locked row, so a double click
 * sends one request: the guard is a ref, which a second click that lands
 * before the re-render also sees. `lock(id, action)` gives a button its
 * `{ loading, disabled }`; a caller whose button has no `loading` prop spreads
 * only `disabled`.
 *
 * A write outlives the page when the DJ navigates away mid-click, so after
 * unmount nothing here touches React state or calls back into the screen
 * (which would toast), and nothing rejects: `allSettled` swallows the reload.
 * A refusal message that must outlive its row is the caller's own state.
 *
 * Not used by `useRotationRowActions.withPending`: those rows do not reload on
 * refusal, and the rotation surfaces are outside the reviews screens.
 */
export function useRowWrite<Action extends string>({
  reload,
  isLostRace,
  onFailure,
  onLostRace,
}: RowWriteOptions<Action>) {
  const inFlight = useRef(new Map<number, Action>());
  const [pending, setPending] = useState<ReadonlyMap<number, Action>>(() => new Map());
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const write = async (id: number, action: Action, run: () => Promise<unknown>) => {
    if (inFlight.current.has(id)) return;
    inFlight.current.set(id, action);
    setPending(new Map(inFlight.current));
    let raced = false;
    try {
      await run();
    } catch (err) {
      if (isLostRace(err)) raced = true;
      else if (mounted.current) onFailure(err, id, action);
    } finally {
      await Promise.allSettled(reload());
      inFlight.current.delete(id);
      if (mounted.current) setPending(new Map(inFlight.current));
    }
    // The notice says the lists have been reloaded, so it waits until they have.
    if (raced && mounted.current) onLostRace?.(id, action);
  };

  const lock = (id: number, action: Action) => ({
    loading: pending.get(id) === action,
    disabled: pending.has(id),
  });

  return { write, lock };
}
