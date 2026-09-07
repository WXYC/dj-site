import { Metadata } from "next";
import { getPageTitle } from "@/lib/utils/page-title";
import { requireAuth, requireRole } from "@/lib/features/authentication/server-utils";
import { Authorization } from "@/lib/features/admin/types";
import Main from "@/src/components/experiences/classic/Layout/Main";
import MusicDepartmentMenu from "@/src/components/experiences/classic/musicDepartment/MusicDepartmentMenu";

export const metadata: Metadata = {
  title: getPageTitle("Music Department"),
};

/**
 * The librarian's landing menu, reproducing `rotation/musicmenu.jsp` and
 * `libraryAdmin/libraryAdminLinks.jsp`.
 *
 * MD-gated to match `/dashboard/library`, the catalog entry point it leads to.
 * Two of its destinations -- Missing Releases and the rotation list -- are
 * DJ-accessible on their own pages, and gating this menu does not tighten
 * them: both keep their own entries in the classic nav bar for every role,
 * which is where a DJ reaches them.
 */
export default async function ClassicMusicDepartmentPage() {
  const session = await requireAuth();
  await requireRole(session, Authorization.MD);

  return (
    <Main>
      <MusicDepartmentMenu />
    </Main>
  );
}
