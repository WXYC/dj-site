import { requireAuth } from "@/lib/features/authentication/server-utils";
import { getReviewsAccess } from "@/lib/features/feature-access.server";
import ReviewsScreen from "@/src/components/experiences/modern/reviews/ReviewsScreen";
import { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPageTitle } from "@/lib/utils/page-title";

export const metadata: Metadata = {
  title: getPageTitle("Reviews"),
};

export default async function ReviewsPage() {
  await requireAuth();

  if (!(await getReviewsAccess()).can_see) {
    notFound();
  }

  return <ReviewsScreen tab="shelf" />;
}
