"use client";

import { useMemo, useRef } from "react";
import type { FlowsheetV2Entry } from "@wxyc/shared";
import {
  archiveStreamApi,
  useGetArchiveStreamInfiniteQuery,
  type ArchiveStreamArg,
} from "@/lib/features/archive-stream/api";
import {
  toArchiveStreamRowFromStreamEntry,
  type ArchiveStreamRow,
} from "@/lib/features/flowsheet/stream-row";
import { useListingRetry, type FailedPage } from "./useListingRetry";

const QUERY_ARG: ArchiveStreamArg = { pageSize: 50 };

export type ArchiveStreamListing = {
  rows: ArchiveStreamRow[];
  isHeadLoading: boolean;
  isNextPageLoading: boolean;
  headFailed: boolean;
  nextPageFailed: boolean;
  /** The page whose failure is shown, held from a retry's click until its request settles. */
  failedPage: FailedPage | null;
  /** True from a retry's click until its request settles, so a notice stays up through it. */
  isRetrying: boolean;
  /** Retries that failed again, so a notice that stayed mounted can announce each one. */
  failedRetries: number;
  /** Read from `reachedStart` alone -- an empty page that still carries a
   * cursor is a quiet stretch, not the end of the archive. */
  hasMore: boolean;
  loadNextPage: () => void;
  /** `refetch()` after a head failure, `fetchNextPage()` after a next-page
   * failure, and a no-op when neither has failed -- each as of the render
   * this `retry` was returned from. */
  retry: () => void;
  hasAnswered: boolean;
};

/**
 * The chronological listing's rows, flattened newest-first across every page
 * fetched so far, with the controls a scroller drives it through.
 *
 * A failure with no page held is a head failure (nothing to show yet); a
 * failure with pages held is a next-page failure (every row fetched before it
 * still stands). `retry` re-requests the first with `refetch()` and the
 * second with `fetchNextPage()`, which keeps `isNextPageLoading` false while
 * a head is being re-requested.
 */
export function useArchiveStreamListing(): ArchiveStreamListing {
  const {
    data,
    isFetching,
    isError,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
    refetch,
  } = useGetArchiveStreamInfiniteQuery(QUERY_ARG);

  // Keyed on the source entry object rather than `entry.id`: appending a
  // page carries the earlier pages' entry objects over, so their rows are
  // reused, while a refetch that changes an entry replaces that entry's
  // object, so its row is converted again.
  const rowCache = useRef(new WeakMap<FlowsheetV2Entry, ArchiveStreamRow>());

  const rows = useMemo(() => {
    if (!data?.pages?.length) return [];
    const seen = new Set<number>();
    const flattened: ArchiveStreamRow[] = [];
    for (const page of data.pages) {
      for (const entry of page.entries) {
        if (seen.has(entry.id)) continue;
        seen.add(entry.id);
        let row = rowCache.current.get(entry);
        if (!row) {
          row = toArchiveStreamRowFromStreamEntry(entry);
          rowCache.current.set(entry, row);
        }
        flattened.push(row);
      }
    }
    return flattened;
  }, [data?.pages]);

  const hasAnyPages = (data?.pages.length ?? 0) > 0;
  const {
    headFailed,
    nextPageFailed,
    retry,
    loadNextPage,
    failedPage,
    isRetrying,
    failedRetries,
  } = useListingRetry({
    key: QUERY_ARG,
    isFetching,
    isError,
    hasAnyPages,
    hasNextPage,
    refetch,
    fetchNextPage,
  });

  // Latched, not read live: once the query has answered (data or an error),
  // it stays answered for the life of this hook instance. The live
  // expression clears `isError` the moment a retry starts fetching, which
  // would otherwise read as "never answered" again while a head failure is
  // being re-requested.
  const hasAnsweredRef = useRef(false);
  if (data !== undefined || isError) hasAnsweredRef.current = true;

  return {
    rows,
    // `isLoading` only rises when the previous result was itself loading or
    // uninitialized, so it stays false for a fetch that follows an error.
    // Deriving from `isFetching` with no page landed instead covers a head
    // retried after a failure the same way it covers the first attempt.
    isHeadLoading: isFetching && !hasAnyPages,
    isNextPageLoading: isFetchingNextPage,
    headFailed,
    nextPageFailed,
    failedPage,
    isRetrying,
    failedRetries,
    hasMore: hasNextPage ?? false,
    loadNextPage,
    retry,
    hasAnswered: hasAnsweredRef.current,
  };
}

/**
 * Holds the pages `useArchiveStreamListing` has walked, from the first time
 * `listingVisible` is true for as long as this hook stays mounted --
 * including while the listing hook itself is unmounted.
 *
 * Must be mounted above the branch that unmounts the listing. Mounted inside
 * that branch it unsubscribes along with the listing, and the endpoint drops
 * its pages on the last unsubscribe.
 *
 * `listingVisible` latches rather than gating continuously, matching
 * `usePlaylistSearchSubscription`: a permalink that never shows the listing
 * must not spend a request on it, but once the listing has been visible, its
 * pages are worth holding for the rest of the visit.
 *
 * `listingVisible` must mean that the chronological listing itself is on
 * screen. This hook applies no condition of its own, and starts the head walk
 * the first time the argument is true, whether or not a listing hook is
 * mounted.
 */
export function useArchiveStreamSubscription(listingVisible: boolean): void {
  const everVisible = useRef(false);
  if (listingVisible) everVisible.current = true;

  archiveStreamApi.endpoints.getArchiveStream.useInfiniteQuerySubscription(
    QUERY_ARG,
    { skip: !everVisible.current },
  );
}
