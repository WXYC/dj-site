import { getUserFromSession, requireAuth, requireRole } from "@/lib/features/authentication/server-utils";
import { Authorization } from "@/lib/features/admin/types";
import { canSeeReviews } from "@/lib/features/reviews/flags";
import PageHeader from "@/src/components/experiences/modern/Header/PageHeader";
import { REVIEW_COPY } from "@/src/components/experiences/modern/reviews/copy";
import ReleaseSlipScreen from "@/src/components/experiences/modern/reviews/ReleaseSlipScreen";
import { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPageTitle } from "@/lib/utils/page-title";

export const metadata: Metadata = {
  title: getPageTitle(REVIEW_COPY.intakeItem.printSlip),
};

export default async function ReleaseSlipPage({ params }: { params: Promise<{ albumId: string; reviewId: string }> }) {
  const session = await requireAuth();
  const { authority } = await getUserFromSession(session);

  if (!canSeeReviews(authority)) {
    notFound();
  }
  await requireRole(session, Authorization.MD);
  const { albumId, reviewId } = await params;
  const album = Number(albumId);
  const review = Number(reviewId);
  if (![album, review].every((n) => Number.isInteger(n) && n > 0)) notFound();

  return (
    <>
      <PageHeader title={REVIEW_COPY.intakeItem.printSlip} />
      <ReleaseSlipScreen albumId={album} reviewId={review} />
    </>
  );
}
