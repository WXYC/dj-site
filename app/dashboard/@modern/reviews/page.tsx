import { getUserFromSession, requireAuth } from "@/lib/features/authentication/server-utils";
import { canSeeReviews } from "@/lib/features/reviews/flags";
import ReviewsPile from "@/src/components/experiences/modern/reviews/ReviewsPile";
import PageHeader from "@/src/components/experiences/modern/Header/PageHeader";
import { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPageTitle } from "@/lib/utils/page-title";

export const metadata: Metadata = {
  title: getPageTitle("Reviews"),
};

export default async function ReviewsPage() {
  const session = await requireAuth();
  const { authority } = await getUserFromSession(session);

  if (!canSeeReviews(authority)) {
    notFound();
  }

  return (
    <>
      <PageHeader title="Reviews" />
      <ReviewsPile />
    </>
  );
}
