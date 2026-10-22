import { useState } from "react";
import { useGetReviewsAccessQuery } from "@/lib/features/feature-access/api";

/**
 * Whether the signed-in account is shown the reviews screens, as the Backend
 * answers it. A read that is loading or failed counts as no access. Each
 * mount asks again, so a screen opened after the answer changed shows the new
 * one without a reload, and an answer that arrived before this mount (kept
 * alive by another subscriber) is not shown while the new read is in flight.
 */
export function useCanSeeReviews(): boolean {
  const [mountedAt] = useState(() => Date.now());
  const { data, isSuccess, fulfilledTimeStamp } = useGetReviewsAccessQuery(undefined, {
    refetchOnMountOrArgChange: true,
  });
  return isSuccess && data?.can_see === true && (fulfilledTimeStamp ?? 0) >= mountedAt;
}
