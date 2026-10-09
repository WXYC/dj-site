import { getUserFromSession, requireAuth, requireRole } from "@/lib/features/authentication/server-utils";
import { Authorization } from "@/lib/features/admin/types";
import { canSeeReviews } from "@/lib/features/reviews/flags";
import PageHeader from "@/src/components/experiences/modern/Header/PageHeader";
import { REVIEW_COPY } from "@/src/components/experiences/modern/reviews/copy";
import IntakeScreen from "@/src/components/experiences/modern/reviews/IntakeScreen";
import { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPageTitle } from "@/lib/utils/page-title";

export const metadata: Metadata = {
  title: getPageTitle(REVIEW_COPY.intake.title),
};

export default async function IntakePage() {
  const session = await requireAuth();
  const { authority } = await getUserFromSession(session);

  if (!canSeeReviews(authority)) {
    notFound();
  }
  await requireRole(session, Authorization.MD);

  return (
    <>
      <PageHeader title={REVIEW_COPY.intake.title} />
      <IntakeScreen />
    </>
  );
}
