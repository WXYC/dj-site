import { requireAuth, requireRole } from "@/lib/features/authentication/server-utils";
import { Authorization } from "@/lib/features/admin/types";
import { getReviewsAccess } from "@/lib/features/feature-access.server";
import { Stack } from "@mui/joy";
import IntakeLanes from "@/src/components/experiences/modern/reviews/IntakeLanes";
import { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPageTitle } from "@/lib/utils/page-title";

export const metadata: Metadata = {
  title: getPageTitle("Reviews"),
};

export default async function ReviewsMusicDirectorsPage() {
  const session = await requireAuth();

  if (!(await getReviewsAccess()).can_see) {
    notFound();
  }
  await requireRole(session, Authorization.MD);

  return (
    <Stack spacing={3}>
      <IntakeLanes />
    </Stack>
  );
}
