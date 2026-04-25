type RosterEventListener = () => void;
const listeners = new Set<RosterEventListener>();

/** Subscribe to roster invalidation events. Returns an unsubscribe function. */
export function onRosterInvalidated(listener: RosterEventListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Notify all subscribers that the roster data should be refetched. */
export function invalidateRoster(): void {
  listeners.forEach((fn) => fn());
}
