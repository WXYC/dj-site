import { requireAuth, requireRole } from "@/lib/features/authentication/server-utils";
import { Authorization } from "@/lib/features/admin/types";
import PageHeader from "@/src/components/experiences/modern/Header/PageHeader";
import FormatAdmin from "@/src/components/experiences/modern/admin/catalog/FormatAdmin";
import GenreAdmin from "@/src/components/experiences/modern/admin/catalog/GenreAdmin";
import { Box } from "@mui/joy";
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
      {/* Main is a fixed 100dvh box with overflow:hidden. On wide screens the
          two sections sit side by side, each scrolling inside its own sheet so
          its composer stays put; stacked on narrow screens, this grid scrolls. */}
      <Box
        sx={(theme) => ({
          flex: 1,
          minHeight: 0,
          display: "grid",
          gap: 2,
          gridTemplateColumns: "minmax(0, 1fr)",
          gridTemplateRows: "auto auto",
          overflow: "auto",
          [theme.breakpoints.up("lg")]: {
            gridTemplateColumns: "minmax(0, 3fr) minmax(0, 2fr)",
            gridTemplateRows: "minmax(0, 1fr)",
            overflow: "hidden",
          },
        })}
      >
        <GenreAdmin />
        <FormatAdmin />
      </Box>
    </>
  );
}
