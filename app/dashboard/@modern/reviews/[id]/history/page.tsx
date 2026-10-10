import { gateReviewRoute } from "@/src/components/experiences/modern/reviews/gateReviewRoute";
import ReviewHistory from "@/src/components/experiences/modern/reviews/ReviewHistory";
import { REVIEW_COPY } from "@/src/components/experiences/modern/reviews/copy";
import ReviewScrollRegion from "@/src/components/experiences/modern/reviews/ReviewScrollRegion";
import PageHeader from "@/src/components/experiences/modern/Header/PageHeader";
import { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPageTitle } from "@/lib/utils/page-title";

export const metadata: Metadata = {
  title: getPageTitle(REVIEW_COPY.history.link),
};

export default async function ReviewHistoryPage({ params }: { params: Promise<{ id: string }> }) {
  const gated = await gateReviewRoute();
  const reviewId = Number((await params).id);
  if (!Number.isInteger(reviewId) || reviewId <= 0) notFound();
  if (gated) return gated;

  return (
    <>
      <PageHeader title={REVIEW_COPY.history.link} />
      <ReviewScrollRegion>
        <ReviewHistory id={reviewId} />
      </ReviewScrollRegion>
    </>
  );
}
