"use client";

import { useEffect, useState } from "react";
import { utcDateISO } from "@/src/utilities/stationTime";

const TICK_MS = 60_000;

/**
 * "Now" as a UTC calendar day, anchored to `anchorMs` (the instant a caller's
 * data was read) and advanced on its own so a tab left open across UTC
 * midnight rolls the day over without a refetch. `anchorMs` undefined
 * (nothing read yet) yields `undefined` -- there is no instant to anchor a
 * clock to.
 *
 * Resets to the anchor instant whenever `anchorMs` changes -- derived during
 * render, the same reset `useServerClockMs` performs for its own anchor --
 * so a fresh read always starts the clock exactly there, never wherever the
 * last tick left it.
 */
export function useUtcDayClock(anchorMs: number | undefined): Date | undefined {
  const [value, setValue] = useState<Date | undefined>(
    anchorMs == null ? undefined : new Date(anchorMs),
  );
  const [anchoredOn, setAnchoredOn] = useState(anchorMs);
  if (anchoredOn !== anchorMs) {
    setAnchoredOn(anchorMs);
    setValue(anchorMs == null ? undefined : new Date(anchorMs));
  }

  // The browser clock is outside React: only a wall-clock timer can notice a
  // UTC day turning over while the tab stays open with no new read to reset
  // the anchor.
  useEffect(() => {
    if (anchorMs == null) return;
    const startedAt = Date.now();
    const id = setInterval(() => {
      const candidate = new Date(anchorMs + (Date.now() - startedAt));
      const candidateDay = utcDateISO(candidate);
      // Commits only on a day change, so the list re-renders once per UTC
      // day rather than once a minute.
      setValue((prev) => (prev != null && utcDateISO(prev) === candidateDay ? prev : candidate));
    }, TICK_MS);
    return () => clearInterval(id);
  }, [anchorMs]);

  return value;
}
