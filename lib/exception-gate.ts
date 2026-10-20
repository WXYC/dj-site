export const DEDUPE_WINDOW_MS = 60_000;
export const BUCKET_CAPACITY = 20;
export const REFILL_INTERVAL_MS = 30 * 60_000;
const MAX_TRACKED_KEYS = 1000;

export interface ExceptionGate {
  /** True when the exception may be sent; false when it was deduped or the bucket is empty. */
  admit(error: Error, context?: Record<string, unknown>): boolean;
  /** Count of exceptions dropped by either gate since creation. */
  readonly dropped: number;
  readonly trackedKeys: number;
}

/**
 * Two ordered gates for manually reported `$exception` events, sharing the
 * PostHog monthly exception cap with every other surface:
 *
 * 1. Dedupe: a key (`$exception_fingerprint`, else name + message) admitted
 *    under 60 s ago is dropped without spending a token.
 * 2. Token bucket: burst 20, refilling one token per 30 minutes (48/day).
 *
 * State lives in the closure, so a module-level gate starts full on each page
 * load. `admit` never throws: on any internal failure it admits the event.
 */
export function createExceptionGate(now: () => number = Date.now): ExceptionGate {
  const seen = new Map<string, number>();
  let tokens = BUCKET_CAPACITY;
  let refilledAt = now();
  let dropped = 0;

  return {
    admit(error, context) {
      try {
        const t = now();
        const fingerprint = context?.$exception_fingerprint;
        const key =
          fingerprint != null
            ? `fp:${String(fingerprint)}`
            : `${error.name}:${error.message}`;

        const last = seen.get(key);
        if (last !== undefined && t - last < DEDUPE_WINDOW_MS) {
          dropped++;
          return false;
        }

        const earned = Math.floor((t - refilledAt) / REFILL_INTERVAL_MS);
        tokens = Math.min(BUCKET_CAPACITY, tokens + earned);
        // A full bucket accrues nothing, so the next refill clock starts now.
        refilledAt = tokens === BUCKET_CAPACITY ? t : refilledAt + earned * REFILL_INTERVAL_MS;
        if (tokens < 1) {
          dropped++;
          return false;
        }
        tokens--;

        seen.delete(key);
        seen.set(key, t);
        if (seen.size > MAX_TRACKED_KEYS) {
          seen.delete(seen.keys().next().value as string);
        }
        return true;
      } catch {
        return true;
      }
    },
    get dropped() {
      return dropped;
    },
    get trackedKeys() {
      return seen.size;
    },
  };
}
