import { useState } from "react";
import { useGetReviewsAccessQuery } from "@/lib/features/feature-access/api";

/**
 * How old an answer may be, at the moment a subscriber mounts, and still be shown while that mount's own read is in
 * flight. A review screen mounts several components that each ask (the editor, then its panels once the review loads),
 * and the later ones must not blink out for a round trip behind an answer the screen has just received. Anything older
 * than this was read before the screen opened, so it is not shown.
 */
export const FRESH_ANSWER_MS = 5_000;

/**
 * Whether the signed-in account is shown the reviews screens, as the Backend answers it. A read that is loading or
 * failed counts as no access. Each mount asks again, so a screen opened after the answer changed shows the new one
 * without a reload: until that read answers, an answer that was already cached when the mount began (kept alive by a
 * subscriber that stays, such as the tab strip) is ignored if it is older than {@link FRESH_ANSWER_MS}.
 */
export function useCanSeeReviews(): boolean {
  const [mountedAt] = useState(() => Date.now());
  const { data, isSuccess, fulfilledTimeStamp } = useGetReviewsAccessQuery(undefined, {
    refetchOnMountOrArgChange: true,
  });
  return isSuccess && data?.can_see === true && (fulfilledTimeStamp ?? 0) >= mountedAt - FRESH_ANSWER_MS;
}
