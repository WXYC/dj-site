import { requireAuth, requireRole } from "@/lib/features/authentication/server-utils";
import { isRotationAdminEnabled } from "@/lib/features/rotation/flags";
import { Authorization } from "@/lib/features/admin/types";
import PageHeader from "@/src/components/experiences/modern/Header/PageHeader";
import { Typography } from "@mui/joy";
import { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPageTitle } from "@/lib/utils/page-title";

export const metadata: Metadata = {
  title: getPageTitle("Add to Rotation"),
};

export default async function RotationBenchPage() {
  if (!isRotationAdminEnabled()) {
    notFound();
  }

  const session = await requireAuth();
  await requireRole(session, Authorization.MD);

  return (
    <>
      <PageHeader title="Add to Rotation" />
      <Typography level="body-sm">Coming soon.</Typography>
    </>
  );
}
