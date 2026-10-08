import { Authorization } from "@/lib/features/admin/types";
import { canSeeReviews } from "@/lib/features/reviews/flags";
import { useAuthentication } from "@/src/hooks/authenticationHooks";

/**
 * Whether the signed-in account is shown the reviews screens. No session, or
 * one whose session read is still pending, counts as `Authorization.NO`.
 */
export function useCanSeeReviews(): boolean {
  const { data: auth } = useAuthentication();
  const authority = "user" in auth ? auth.user?.authority : undefined;
  return canSeeReviews(authority ?? Authorization.NO);
}
