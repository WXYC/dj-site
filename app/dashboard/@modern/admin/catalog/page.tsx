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
      {/* Main is a fixed 100dvh box with overflow:hidden, so a page that owns no
          scroll container has its overflow clipped away rather than scrolled to.
          minHeight:0 is what lets this flex child shrink below its content and
          actually scroll. Both lists grow without bound and each card's add form
          sits below its list, so without this the forms become unreachable. */}
      <Stack spacing={2} sx={{ flex: 1, minHeight: 0, overflow: "auto" }}>
        <FormatAdmin />
        <GenreAdmin />
      </Stack>
    </>
  );
}
