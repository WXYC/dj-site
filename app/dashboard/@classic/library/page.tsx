import { Metadata } from "next";
import { getPageTitle } from "@/lib/utils/page-title";
import { requireAuth, requireRole } from "@/lib/features/authentication/server-utils";
import { Authorization } from "@/lib/features/admin/types";
import Main from "@/src/components/experiences/classic/Layout/Main";
import LibraryChooser from "@/src/components/experiences/classic/catalog/LibraryChooser";

export const metadata: Metadata = {
  title: getPageTitle("Find an Artist"),
};

/**
 * Reproduces `chooseLibraryCodeOrArtist.jsp` and, on a multi-match,
 * `multipleArtistsDisplay.jsp` -- the classic catalog's
 * artist-vs-Various-Artists entry point and its code-search resolution, both
 * gated to `hasAdminAccess()` in the JSP's `mainmenu.jsp`. `LibraryChooser`
 * owns which of the two screens is showing; see its doc for why that toggle
 * lives below this one URL rather than as a separate route.
 */
export default async function LibraryPage() {
  const session = await requireAuth();
  await requireRole(session, Authorization.MD);

  return (
    <Main>
      <LibraryChooser />
    </Main>
  );
}
