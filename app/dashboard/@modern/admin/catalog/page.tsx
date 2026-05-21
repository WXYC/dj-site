import { requireAuth, requireRole } from "@/lib/features/authentication/server-utils";
import { Authorization } from "@/lib/features/admin/types";
import AdminCatalogExperience from "@/src/components/experiences/modern/admin/catalog/AdminCatalogExperience";
import { Metadata } from "next";
import { getPageTitle } from "@/lib/utils/page-title";

export const metadata: Metadata = {
  title: getPageTitle("Catalog admin"),
};

export default async function AdminCatalogPage() {
  const session = await requireAuth();
  await requireRole(session, Authorization.SM);

  return <AdminCatalogExperience />;
}
