import { requireAuth, requireRole } from "@/lib/features/authentication/server-utils";
import { isRotationAdminEnabled } from "@/lib/features/rotation/flags";
import { Authorization } from "@/lib/features/admin/types";
import PageHeader from "@/src/components/experiences/modern/Header/PageHeader";
import AddToRotationButton from "@/src/components/experiences/modern/admin/rotation/shelf/AddToRotationButton";
import RotationShelf from "@/src/components/experiences/modern/admin/rotation/shelf/RotationShelf";
import { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPageTitle } from "@/lib/utils/page-title";

export const metadata: Metadata = {
  title: getPageTitle("Rotation Shelf"),
};

export default async function RotationShelfPage() {
  if (!isRotationAdminEnabled()) {
    notFound();
  }

  const session = await requireAuth();
  await requireRole(session, Authorization.MD);

  return (
    <>
      <PageHeader title="Rotation Shelf">
        <AddToRotationButton />
      </PageHeader>
      <RotationShelf />
    </>
  );
}
