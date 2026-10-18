import { getUserFromSession, requireAuth, requireRole } from "@/lib/features/authentication/server-utils";
import { Authorization } from "@/lib/features/admin/types";
import { canSeeReviews } from "@/lib/features/reviews/flags";
import { Stack } from "@mui/joy";
import IntakeLogForm from "@/src/components/experiences/modern/reviews/IntakeLogForm";
import IntakeLanes from "@/src/components/experiences/modern/reviews/IntakeLanes";
import { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPageTitle } from "@/lib/utils/page-title";

export const metadata: Metadata = {
  title: getPageTitle("Reviews"),
};

export default async function ReviewsMusicDirectorsPage() {
  const session = await requireAuth();
  const { authority } = await getUserFromSession(session);

  if (!canSeeReviews(authority)) {
    notFound();
  }
  await requireRole(session, Authorization.MD);

  return (
    <Stack spacing={3}>
      <IntakeLogForm />
      <IntakeLanes />
    </Stack>
  );
}
