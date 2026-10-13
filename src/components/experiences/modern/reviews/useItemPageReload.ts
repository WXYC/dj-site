import { intakeApi } from "@/lib/features/reviews/intakeApi";
import { lastReviewsWriteAnsweredAt } from "@/lib/features/reviews/api";
import { reviewApi } from "@/lib/features/reviews/reviewApi";
import { useAppDispatch } from "@/lib/hooks";
import { useMounted } from "@/src/hooks/useRowWrite";

/**
 * Every write on this page reloads through this before its line appears: the
 * item, its reviews, and the cover review when the page reads it by id
 * (`coverId`). It follows the `useRowWrite` reload rule: `initiate` with the
 * hooks' own args, never a hook's `refetch()`, which throws once the page has
 * unmounted. Resolves to whether the page is still mounted, so the caller sets
 * no state after it has gone, and the item as reloaded (null when that read
 * failed). A failed read does not reject.
 *
 * It also waits for every request the API has in flight to settle, and for the
 * reads that settling starts. RTK Query queues a write's invalidation while any
 * other request is pending, so the refetch it owes can start after the reload
 * resolved; a caller that released its hold then would let a press reread into
 * that older read, whose answer lands over the press's write.
 *
 * A read that began before the latest write fulfilled and was still in flight is joined by that write's refetch and by
 * these forced reads instead of being repeated, and it answers with the record as it stood before the write. When any of
 * the three reads is such a one, they are made again once it has settled.
 */
export function useItemPageReload(id: number, coverId?: number) {
  const dispatch = useAppDispatch();
  const mounted = useMounted();
  const refresh = { subscribe: false, forceRefetch: true } as const;
  // Settling a request starts the refetch queued behind it before its promise resolves, so the next look finds that read.
  const inFlight = () => [...dispatch(reviewApi.util.getRunningQueriesThunk()), ...dispatch(reviewApi.util.getRunningMutationsThunk())];
  const load = () => Promise.allSettled([
    dispatch(intakeApi.endpoints.getIntakeItem.initiate(id, refresh)),
    dispatch(reviewApi.endpoints.getItemReviews.initiate(id, refresh)),
    ...(coverId === undefined ? [] : [dispatch(reviewApi.endpoints.getReview.initiate(coverId, refresh))]),
  ]);
  const settle = async () => {
    for (let running = inFlight(); running.length > 0; running = inFlight()) await Promise.allSettled(running);
  };
  const joinedPreWriteRead = () =>
    dispatch((_, getState) => {
      const state = getState();
      const reads = [
        intakeApi.endpoints.getIntakeItem.select(id)(state),
        reviewApi.endpoints.getItemReviews.select(id)(state),
        ...(coverId === undefined ? [] : [reviewApi.endpoints.getReview.select(coverId)(state)]),
      ];
      return reads.some((read) => (read.startedTimeStamp ?? Infinity) < lastReviewsWriteAnsweredAt());
    });
  return async () => {
    let [itemRead] = await load();
    await settle();
    if (joinedPreWriteRead()) {
      [itemRead] = await load();
      await settle();
    }
    const read = itemRead.status === "fulfilled" ? itemRead.value : undefined;
    return { mounted: mounted.current, item: read?.isError ? null : (read?.data ?? null) };
  };
}
