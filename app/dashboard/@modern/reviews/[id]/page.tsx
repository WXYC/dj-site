import { getUserFromSession, requireAuth } from "@/lib/features/authentication/server-utils";
import { Authorization } from "@/lib/features/admin/types";
import { canSeeReviews, reviewsAudience } from "@/lib/features/reviews/flags";
import ReviewEditor from "@/src/components/experiences/modern/reviews/ReviewEditor";
import ReviewStaffOnlyNotice from "@/src/components/experiences/modern/reviews/ReviewStaffOnlyNotice";
import { REVIEW_COPY } from "@/src/components/experiences/modern/reviews/copy";
import PageHeader from "@/src/components/experiences/modern/Header/PageHeader";
import { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPageTitle } from "@/lib/utils/page-title";

export const metadata: Metadata = {
  title: getPageTitle(REVIEW_COPY.pageTitle),
};

export default async function ReviewEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireAuth();
  const { authority } = await getUserFromSession(session);
  const reviewId = Number((await params).id);
  if (!Number.isInteger(reviewId) || reviewId <= 0) notFound();

  if (!canSeeReviews(authority)) {
    // The emails Backend-Service sends link every DJ here, so while reviews are
    // staff-only a DJ gets one line instead of a not-found page.
    if (reviewsAudience() !== "staff" || authority < Authorization.DJ) notFound();
    return (
      <>
        <PageHeader title={REVIEW_COPY.pageTitle} />
        <ReviewStaffOnlyNotice />
      </>
    );
  }

  return (
    <>
      <PageHeader title={REVIEW_COPY.pageTitle} />
      <ReviewEditor id={reviewId} />
    </>
  );
}
