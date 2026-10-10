import { getUserFromSession, requireAuth, requireRole } from "@/lib/features/authentication/server-utils";
import { Authorization } from "@/lib/features/admin/types";
import { canSeeReviews } from "@/lib/features/reviews/flags";
import ScrollRegion from "@/src/components/experiences/modern/ScrollRegion";
import PageHeader from "@/src/components/experiences/modern/Header/PageHeader";
import { REVIEW_COPY } from "@/src/components/experiences/modern/reviews/copy";
import IntakeSlipScreen from "@/src/components/experiences/modern/reviews/IntakeSlipScreen";
import { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPageTitle } from "@/lib/utils/page-title";

export const metadata: Metadata = {
  title: getPageTitle(REVIEW_COPY.intakeItem.printSlip),
};

export default async function IntakeSlipPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireAuth();
  const { authority } = await getUserFromSession(session);

  if (!canSeeReviews(authority)) {
    notFound();
  }
  await requireRole(session, Authorization.MD);
  const itemId = Number((await params).id);
  if (!Number.isInteger(itemId) || itemId <= 0) notFound();

  return (
    <>
      <PageHeader title={REVIEW_COPY.intakeItem.printSlip} />
      <ScrollRegion>
        <IntakeSlipScreen id={itemId} />
      </ScrollRegion>
    </>
  );
}
