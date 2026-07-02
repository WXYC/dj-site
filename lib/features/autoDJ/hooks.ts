"use client";
/**
 * Shared auto-DJ status hooks. Both the greyscale shell and the flowsheet banner
 * call these; RTK Query dedupes the `getAutoDJStatus` query so there is a single
 * 10s poll regardless of how many components subscribe. Polling is skipped
 * entirely when the orchestrator URL is not configured.
 */
import { useGetAutoDJStatusQuery } from "./api";
import { isAutoDJStatusEnabled } from "./flags";
import type { AutoDJStatus } from "@wxyc/shared/auto-dj";

const POLL_INTERVAL_MS = 10_000;

export function useAutoDJStatus(): AutoDJStatus | undefined {
  const enabled = isAutoDJStatusEnabled();
  const { data } = useGetAutoDJStatusQuery(undefined, {
    pollingInterval: POLL_INTERVAL_MS,
    skip: !enabled,
  });
  return enabled ? data : undefined;
}

export function useAutoDJActive(): boolean {
  return Boolean(useAutoDJStatus()?.active);
}
