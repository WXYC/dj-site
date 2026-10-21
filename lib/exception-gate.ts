export const DEDUPE_WINDOW_MS = 60_000;
export const BUCKET_CAPACITY = 20;
export const REFILL_INTERVAL_MS = 30 * 60_000;
export const DROP_WARN_INTERVAL_MS = 15 * 60_000;
const MAX_TRACKED_KEYS = 1000;

export interface ExceptionGate {
  /** True when the exception may be sent; false when it was deduped or the bucket is empty. */
  admit(error: Error, context?: Record<string, unknown>, label?: string): boolean;
  /** Count of exceptions dropped by either gate since creation. */
  readonly dropped: number;
  /** Drops since the last call; resets the count. Attach it to the next admitted event. */
  takeDropped(): number;
  readonly trackedKeys: number;
}

/**
 * Two ordered gates for manually reported `$exception` events, sharing the
 * PostHog monthly exception cap with every other surface:
 *
 * 1. Dedupe: a key (error type + `$exception_fingerprint` or message, plus an
 *    optional `label`) admitted under 60 s ago is dropped without spending a
 *    token. `label` must be a string literal at the call site, never runtime
 *    or user-derived data; `context` never enters the key.
 * 2. Token bucket: burst 20, refilling one token per 30 minutes (48/day).
 *
 * State lives in the closure, so a module-level gate starts full on each page
 * load. Drops warn on the console at most once per 15 minutes. `admit` never throws: on any internal failure it admits the event.
 */
export function createExceptionGate(
  now: () => number = Date.now,
  capacity: number = BUCKET_CAPACITY
): ExceptionGate {
  const seen = new Map<string, number>();
  let tokens = capacity;
  let refilledAt = now();
  let dropped = 0;
  let sinceLast = 0;
  let warnedAt: number | undefined;

  const drop = (t: number) => {
    dropped++;
    sinceLast++;
    if (warnedAt === undefined || t - warnedAt >= DROP_WARN_INTERVAL_MS) {
      warnedAt = t;
      console.warn(`[exception-gate] dropped ${sinceLast} exception(s) since the last one sent`);
    }
    return false;
  };

  return {
    admit(error, context, label) {
      try {
        const t = now();
        const fingerprint = context?.$exception_fingerprint;
        const base =
          fingerprint != null
            ? `${error.name}:fp:${String(fingerprint)}`
            : `${error.name}:${error.message}`;
        const key = label === undefined ? base : `${label}|${base}`;

        const last = seen.get(key);
        if (last !== undefined && t - last < DEDUPE_WINDOW_MS) {
          return drop(t);
        }

        const earned = Math.floor((t - refilledAt) / REFILL_INTERVAL_MS);
        tokens = Math.min(capacity, tokens + earned);
        // A full bucket accrues nothing, so the next refill clock starts now.
        refilledAt = tokens === capacity ? t : refilledAt + earned * REFILL_INTERVAL_MS;
        if (tokens < 1) {
          return drop(t);
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
    takeDropped() {
      const n = sinceLast;
      sinceLast = 0;
      return n;
    },
    get dropped() {
      return dropped;
    },
    get trackedKeys() {
      return seen.size;
    },
  };
}
