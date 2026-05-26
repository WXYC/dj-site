"use client";

import { useEffect } from "react";
import {
  liveUpdatesConnectionReleased,
  liveUpdatesConnectionRequested,
} from "@/lib/features/flowsheet/live-updates-slice";
import { useAppDispatch } from "@/lib/hooks";

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
