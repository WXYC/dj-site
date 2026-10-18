import { gateReviewRoute } from "@/src/components/experiences/modern/reviews/gateReviewRoute";
import ReviewEditor from "@/src/components/experiences/modern/reviews/ReviewEditor";
import { REVIEW_COPY } from "@/src/components/experiences/modern/reviews/copy";
import ScrollRegion from "@/src/components/experiences/modern/ScrollRegion";
import { Metadata } from "next";
import { notFound } from "next/navigation";
import { parseEditorOrigin } from "@/lib/features/reviews/paths";
import { getPageTitle } from "@/lib/utils/page-title";

export const metadata: Metadata = {
  title: getPageTitle(REVIEW_COPY.pageTitle),
};

export default async function ReviewEditorPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ arrived?: string; from?: string; stage?: string; record?: string }> }) {
  const gated = await gateReviewRoute();
  const reviewId = Number((await params).id);
  if (!Number.isInteger(reviewId) || reviewId <= 0) notFound();
  if (gated) return gated;

  const query = await searchParams;
  return (
    <ScrollRegion>
      <ReviewEditor id={reviewId} arrivedFromRequest={query.arrived === "request"} origin={parseEditorOrigin(query)} />
    </ScrollRegion>
  );
}
