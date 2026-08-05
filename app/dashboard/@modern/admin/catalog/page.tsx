import { requireAuth, requireRole } from "@/lib/features/authentication/server-utils";
import { Authorization } from "@/lib/features/admin/types";
import PageHeader from "@/src/components/experiences/modern/Header/PageHeader";
import FormatAdmin from "@/src/components/experiences/modern/admin/catalog/FormatAdmin";
import GenreAdmin from "@/src/components/experiences/modern/admin/catalog/GenreAdmin";
import { Stack } from "@mui/joy";
import { Metadata } from "next";
import { getPageTitle } from "@/lib/utils/page-title";

export const metadata: Metadata = {
  title: getPageTitle("Catalog Admin"),
};

export default async function CatalogAdminPage() {
  const session = await requireAuth();
  await requireRole(session, Authorization.MD);

  return (
    <>
      <PageHeader title="Catalog Admin" />
      <Stack spacing={2}>
        <FormatAdmin />
        <GenreAdmin />
      </Stack>
    </>
  );
}
