import { useState, useEffect } from "react";

/**
 * `value`, held back until it has gone `delay` ms without changing.
 *
 * `settleKey` is for a caller that can tell a finished edit from one still in
 * progress: when the key changes, the current `value` is adopted at once and
 * the wait applies again from the next change. Omitted, nothing ever settles
 * early. The key is a primitive because it is compared by identity on every
 * render: an object built inline would differ each time, and the render that
 * adopts it would restart without end.
 */
export function useDebouncedValue<T>(
  value: T,
  delay: number,
  settleKey?: string | number,
): T {
  const [debounced, setDebounced] = useState(value);
  const [settledKey, setSettledKey] = useState(settleKey);

  // Adjusted during render rather than in an effect: React re-renders before
  // committing, so no committed render pairs the new key with the old value.
  if (!Object.is(settledKey, settleKey)) {
    setSettledKey(settleKey);
    setDebounced(value);
  }

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}
