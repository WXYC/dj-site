import { Metadata } from "next";
import { getPageTitle } from "@/lib/utils/page-title";
import { requireAuth, requireRole } from "@/lib/features/authentication/server-utils";
import { Authorization } from "@/lib/features/admin/types";
import Main from "@/src/components/experiences/classic/Layout/Main";
import ReleaseCrossReferences from "@/src/components/experiences/classic/library/ReleaseCrossReferences";

export const metadata: Metadata = {
  title: getPageTitle("Library Release Cross-References"),
};

/**
 * Reproduces `libraryAdmin/xrefsToLibraryReleases.jsp`, reached from
 * `mainmenu.jsp` as `crossReference?mode=displayLibraryReleaseCrossReferences`.
 * MD-gated for the same reasons as its sibling.
 */
export default async function ClassicReleaseCrossReferencesPage() {
  const session = await requireAuth();
  await requireRole(session, Authorization.MD);

  return (
    <Main>
      <ReleaseCrossReferences />
    </Main>
  );
}
