import { gateReviewRoute } from "@/src/components/experiences/modern/reviews/gateReviewRoute";
import NewReview from "@/src/components/experiences/modern/reviews/NewReview";
import { REVIEW_COPY } from "@/src/components/experiences/modern/reviews/copy";
import ScrollRegion from "@/src/components/experiences/modern/ScrollRegion";
import PageHeader from "@/src/components/experiences/modern/Header/PageHeader";
import { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPageTitle } from "@/lib/utils/page-title";

export const metadata: Metadata = {
  title: getPageTitle(REVIEW_COPY.pageTitle),
};

export default async function NewReviewPage({ searchParams }: { searchParams: Promise<{ album_id?: string }> }) {
  const gated = await gateReviewRoute();
  const albumId = Number((await searchParams).album_id);
  if (!Number.isInteger(albumId) || albumId <= 0) notFound();
  if (gated) return gated;

  return (
    <>
      <PageHeader title={REVIEW_COPY.pageTitle} />
      <ScrollRegion>
        <NewReview albumId={albumId} />
      </ScrollRegion>
    </>
  );
}
