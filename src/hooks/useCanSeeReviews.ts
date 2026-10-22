import { useGetReviewsAccessQuery } from "@/lib/features/feature-access/api";

/**
 * Whether the signed-in account is shown the reviews screens, as the Backend
 * answers it. A read that is loading or failed counts as no access. Each
 * mount asks again, so a screen opened after the answer changed shows the new
 * one without a reload.
 */
export function useCanSeeReviews(): boolean {
  const { data, isSuccess } = useGetReviewsAccessQuery(undefined, { refetchOnMountOrArgChange: true });
  return isSuccess && data?.can_see === true;
}
