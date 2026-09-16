import { requireAuth, requireRole } from "@/lib/features/authentication/server-utils";
import { isRotationAdminEnabled } from "@/lib/features/rotation/flags";
import { Authorization } from "@/lib/features/admin/types";
import PageHeader from "@/src/components/experiences/modern/Header/PageHeader";
import RotationAdminList from "@/src/components/experiences/modern/admin/rotation/RotationAdminList";
import { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPageTitle } from "@/lib/utils/page-title";

// Allowed to block: the root layout resolves the session before this renders,
// so nothing below it can prerender until that read moves behind Suspense.
export const instant = false;

export const metadata: Metadata = {
  title: getPageTitle("Rotation List"),
};

export default async function RotationListPage() {
  if (!isRotationAdminEnabled()) {
    notFound();
  }

  const session = await requireAuth();
  await requireRole(session, Authorization.MD);

  return (
    <>
      <PageHeader title="Rotation List" />
      <RotationAdminList />
    </>
  );
}
