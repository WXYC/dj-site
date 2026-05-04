import { requireAuth, requireRole } from "@/lib/features/authentication/server-utils";
import { Authorization } from "@/lib/features/admin/types";
import PageHeader from "@/src/components/experiences/modern/Header/PageHeader";
import AdminCatalogForm from "@/src/components/experiences/modern/admin/catalog/AdminCatalogForm";
import { Metadata } from "next";
import { getPageTitle } from "@/lib/utils/page-title";

export const metadata: Metadata = {
  title: getPageTitle("Add to catalog"),
};

export default async function AdminCatalogPage() {
  const session = await requireAuth();
  await requireRole(session, Authorization.SM);

  return (
    <>
      <PageHeader title="Add to catalog" />
      <AdminCatalogForm />
    </>
  );
}
