import type { AppDispatch } from "@/lib/store";
import { flowsheetApi } from "./api";
import { FLOWSHEET_METADATA_REFETCH_DELAY_MS } from "./constants";
import { patchEntryById } from "./infinite-cache";

/**
 * Schedule a deferred surgical refetch of one flowsheet entry's metadata so
 * the row picks up backend's async LML enrichment (artwork, streaming URLs,
 * artist bio) without waiting for the next 60s polling cycle.
 *
 * Surgical rather than `invalidateTags(["Flowsheet"])` — that would refetch
 * every loaded `getInfiniteEntries` page. Instead, the timer refetches only
 * the now-playing row (single endpoint, single entry), then patches the
 * matching entry in the infinite-query cache via `updateQueryData`.
 *
 * If the now-playing entry's id no longer matches `entryId` by the time the
 * timer fires (rare: another insert landed within the 2s window), the patch
 * is skipped and the 60s polling cycle picks up the metadata. If the refetch
 * itself fails (network down, server error), the helper swallows the error
 * — a stale-but-rendered row is better than a thrown promise that escapes
 * `setTimeout` and crashes the host.
 *
 * Returns `void`. The fire-and-forget timer is not cancellable from the
 * caller; in practice no caller needs to cancel (see #476 PR notes).
 */
export function scheduleDeferredFlowsheetRefetch(
  dispatch: AppDispatch,
  entryId: number
): void {
  setTimeout(() => {
    void (async () => {
      try {
        const result = await dispatch(
          flowsheetApi.endpoints.getNowPlaying.initiate(undefined, {
            forceRefetch: true,
          })
        ).unwrap();
        if (!result || result.id !== entryId) return;
        dispatch(
          flowsheetApi.util.updateQueryData(
            "getInfiniteEntries",
            undefined,
            (draft) => {
              patchEntryById(draft, entryId, result);
            }
          )
        );
      } catch {
        // Refetch failed; the 60s polling cycle on getInfiniteEntries will
        // pick up the metadata on its next pass. Nothing user-actionable.
      }
    })();
  }, FLOWSHEET_METADATA_REFETCH_DELAY_MS);
}
