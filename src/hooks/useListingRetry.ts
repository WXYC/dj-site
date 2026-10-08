import { useCallback, useState } from "react";

/** The page whose request failed: the first page of the listing, or a later one. */
export type FailedPage = "first" | "later";

/**
 * A cursor-paged listing's failure, retry and load-more state, as returned by
 * `useListingRetry`; each listing hook includes it in its own return value.
 */
export type ListingRetryState = {
  /** A failure with no page held for this listing: nothing to show yet. */
  headFailed: boolean;
  /** A failure with pages held for this listing: the rows already loaded still stand. */
  nextPageFailed: boolean;
  /** The page whose failure is shown, held from a retry's click until its request settles. */
  failedPage: FailedPage | null;
  /** True from a retry's click until its request settles, so a notice stays up through it. */
  isRetrying: boolean;
  /** Retries that failed again, so a notice that stayed mounted can announce each one. */
  failedRetries: number;
  /** `refetch()` after a head failure, `fetchNextPage()` after a next-page
   * failure, and a no-op when neither has failed -- each as of the render
   * this `retry` was returned from. */
  retry: () => void;
  /** Requests the next page; a no-op when there is none, after a failure, and while a fetch is in flight. */
  loadNextPage: () => void;
};

/**
 * Classifies a cursor-paged listing's failure, retries it, and gates loading
 * more pages on it and on the listing being idle.
 *
 * Once `headFailed` or `nextPageFailed` holds, `retry` is the only way back in
 * and `loadNextPage` is a no-op. A rejected page is not appended, so `hasNextPage`
 * stays true, and the callers that drive `loadNextPage` are re-armed by the very
 * status change a failure produces (an IntersectionObserver rebuilt on a loading
 * flip fires at once for a sentinel already in view); left ungated, one broken
 * page becomes an unthrottled retry loop. `loadNextPage` is likewise a no-op
 * while the listing is fetching, so callers need no loading flag of their own
 * and a re-check while a fetch is pending is a clean no-op.
 *
 * `key` names the listing a failure belongs to; a retry is dropped when it changes
 * identity, so a sort or query change mid-retry cannot carry the old failure onto
 * the new listing. It is compared with `!==`, so a listing whose key never changes
 * passes a module constant, and a freshly built object each render would drop
 * every retry on the render after it starts.
 *
 * `hasAnyPages` means pages are held for `key`. A caller whose data can still hold
 * the previous key's pages computes it from current-key data.
 *
 * The failure a retry answers is held from the click until the retried request
 * stops fetching: `isError` clears the moment the request starts, and a notice
 * that unmounted then would drop keyboard focus from the control just used.
 */
export function useListingRetry({
  key,
  isFetching,
  isError,
  hasAnyPages,
  hasNextPage,
  refetch,
  fetchNextPage,
}: {
  key: unknown;
  isFetching: boolean;
  isError: boolean;
  hasAnyPages: boolean;
  hasNextPage: boolean | undefined;
  refetch: () => unknown;
  fetchNextPage: () => unknown;
}): ListingRetryState {
  const headFailed = isError && !hasAnyPages;
  const nextPageFailed = isError && hasAnyPages;

  const [retrying, setRetrying] = useState<{
    failedPage: FailedPage;
    started: boolean;
    key: unknown;
  } | null>(null);
  // Retries that failed again, so a notice that stayed mounted through one
  // can announce the new failure.
  const [failedRetries, setFailedRetries] = useState(0);
  // Adjusted during render, not in an effect, so the retry state never paints
  // a render behind the flags it derives from. Only a request seen in flight
  // can end a retry: `started` latches the first render where `isFetching` is
  // up, so a render before it rises never reads as the request having settled.
  // The key check runs first, so a retry abandoned by a key change is dropped
  // rather than counted as a failed one.
  if (retrying && retrying.key !== key) {
    setRetrying(null);
  } else if (retrying && !retrying.started && isFetching) {
    setRetrying({ ...retrying, started: true });
  } else if (retrying?.started && !isFetching) {
    setRetrying(null);
    if (isError) setFailedRetries(failedRetries + 1);
  }

  // A failed later page goes back in through `fetchNextPage()`, never
  // `refetch()`: a forced infinite query re-walks every cached page from the
  // first and never reaches the one that failed.
  const retry = useCallback(() => {
    if (headFailed) {
      setRetrying({ failedPage: "first", started: false, key });
      void refetch();
    } else if (nextPageFailed) {
      setRetrying({ failedPage: "later", started: false, key });
      void fetchNextPage();
    }
  }, [headFailed, nextPageFailed, refetch, fetchNextPage, key]);

  const loadNextPage = useCallback(() => {
    if (hasNextPage && !isError && !isFetching) void fetchNextPage();
  }, [hasNextPage, isError, isFetching, fetchNextPage]);

  return {
    headFailed,
    nextPageFailed,
    retry,
    loadNextPage,
    failedPage:
      retrying?.failedPage ??
      (headFailed ? "first" : nextPageFailed ? "later" : null),
    isRetrying: retrying !== null,
    failedRetries,
  };
}
