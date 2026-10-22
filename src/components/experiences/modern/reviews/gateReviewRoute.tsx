import { notFound } from "next/navigation";
import { getUserFromSession, requireAuth } from "@/lib/features/authentication/server-utils";
import { Authorization } from "@/lib/features/admin/types";
import { getReviewsAccess } from "@/lib/features/feature-access.server";
import PageHeader from "../Header/PageHeader";
import { REVIEW_COPY } from "./copy";
import ReviewStaffOnlyNotice from "./ReviewStaffOnlyNotice";

/**
 * The gate every review route shares. Returns `null` when the signed-in
 * account may see reviews, the staff-only page for a DJ while reviews are
 * staff-only, and otherwise answers not-found.
 */
export async function gateReviewRoute() {
  const session = await requireAuth();
  const [{ authority }, access] = await Promise.all([getUserFromSession(session), getReviewsAccess()]);
  if (access.can_see) {
    return null;
  }
  // The emails Backend-Service sends link every DJ here, so while reviews are
  // staff-only a DJ gets one line instead of a not-found page.
  if (access.audience !== "staff" || authority < Authorization.DJ) {
    notFound();
  }
  return (
    <>
      <PageHeader title={REVIEW_COPY.pageTitle} />
      <ReviewStaffOnlyNotice />
    </>
  );
}
