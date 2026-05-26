"use client";

import { useEffect } from "react";
import {
  FLOWSHEET_POLL_FAST_MS,
  FLOWSHEET_POLL_SLOW_MS,
} from "@/lib/features/flowsheet/constants";
import {
  liveUpdatesConnectionReleased,
  liveUpdatesConnectionRequested,
  liveUpdatesSlice,
} from "@/lib/features/flowsheet/live-updates-slice";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";

/**
 * Ref-counted opt-in for the live-updates SSE connection. Each mount of a
 * subscriber dispatches `liveUpdatesConnectionRequested`; the listener
 * middleware opens the EventSource on the 0→1 transition. Each unmount
 * dispatches `liveUpdatesConnectionReleased`; the middleware closes the
 * EventSource on the 1→0 transition. Multiple concurrent subscribers
 * therefore share a single connection.
 */
export function useSSEConnection(): void {
  const dispatch = useAppDispatch();
  useEffect(() => {
    dispatch(liveUpdatesConnectionRequested());
    return () => {
      dispatch(liveUpdatesConnectionReleased());
    };
  }, [dispatch]);
}

/**
 * Returns the polling interval to pass to RTK Query for flowsheet-shaped
 * queries (`getInfiniteEntries`, `getNowPlaying`). Slows to the safety-poll
 * cadence while SSE is delivering live updates; restores fast polling on
 * disconnect.
 *
 * Both `useShowControl` and `useFlowsheet` subscribe to `getInfiniteEntries`
 * with their own options, and RTK Query takes the MIN `pollingInterval`
 * across active subscribers — so all subscribers must read from this same
 * hook or the fast cadence wins.
 */
export function useFlowsheetPollingInterval(): number {
  const sseConnected = useAppSelector(
    liveUpdatesSlice.selectors.selectLiveUpdatesIsConnected
  );
  return sseConnected ? FLOWSHEET_POLL_SLOW_MS : FLOWSHEET_POLL_FAST_MS;
}
