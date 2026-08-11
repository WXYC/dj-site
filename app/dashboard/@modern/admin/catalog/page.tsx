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
          `overflow: auto` is what makes this scroll: a scroll container's
          automatic minimum size is already zero, so minHeight here is belt and
          braces for consistency with the other scroll panes, not the mechanism.
          Both lists grow without bound and each card's add form sits below its
          list, so without a scroll container the forms become unreachable. */}
      <Stack spacing={2} sx={{ flex: 1, minHeight: 0, overflow: "auto" }}>
        <FormatAdmin />
        <GenreAdmin />
      </Stack>
    </>
  );
}
