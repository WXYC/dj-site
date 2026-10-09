import { intakeApi } from "@/lib/features/reviews/intakeApi";
import { reviewApi } from "@/lib/features/reviews/reviewApi";
import { useAppDispatch } from "@/lib/hooks";
import { useMounted } from "@/src/hooks/useRowWrite";

/**
 * Every write on this page reloads through this before its line appears: the
 * item, its reviews, and the cover review when the page reads it by id
 * (`coverId`). It follows the `useRowWrite` reload rule: `initiate` with the
 * hooks' own args, never a hook's `refetch()`, which throws once the page has
 * unmounted. Resolves to whether the page is still mounted, so the caller sets
 * no state after it has gone. A failed read does not reject.
 */
export function useItemPageReload(id: number, coverId?: number) {
  const dispatch = useAppDispatch();
  const mounted = useMounted();
  const refresh = { subscribe: false, forceRefetch: true } as const;
  return async () => {
    await Promise.allSettled([
      dispatch(intakeApi.endpoints.getIntakeItem.initiate(id, refresh)),
      dispatch(reviewApi.endpoints.getItemReviews.initiate(id, refresh)),
      ...(coverId === undefined ? [] : [dispatch(reviewApi.endpoints.getReview.initiate(coverId, refresh))]),
    ]);
    return mounted.current;
  };
}
