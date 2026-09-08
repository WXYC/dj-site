import { Metadata } from "next";
import { getPageTitle } from "@/lib/utils/page-title";
import { requireAuth, requireRole } from "@/lib/features/authentication/server-utils";
import { Authorization } from "@/lib/features/admin/types";
import Main from "@/src/components/experiences/classic/Layout/Main";
import ArtistCrossReferences from "@/src/components/experiences/classic/library/ArtistCrossReferences";

export const metadata: Metadata = {
  title: getPageTitle("Library Code Cross-References"),
};

/**
 * Reproduces `libraryAdmin/xrefsToLibraryCodes.jsp`, reached from
 * `mainmenu.jsp` as `crossReference?mode=displayLibraryCodeCrossReferences`.
 *
 * MD-gated because that link sits inside the JSP's `hasAdminAccess()` block,
 * unlike Missing Releases and the rotation links beside it, and because
 * Backend gates the listing at `catalog: ['write']` — a read at the write
 * tier, which selects the same pair of roles the JSP's flag names. The menu
 * entry is additionally flag-gated, but that controls discoverability alone,
 * so the gate has to hold on the URL.
 */
export default async function ClassicArtistCrossReferencesPage() {
  const session = await requireAuth();
  await requireRole(session, Authorization.MD);

  return (
    <Main>
      <ArtistCrossReferences />
    </Main>
  );
}
