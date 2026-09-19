import { Metadata } from "next";
import { getPageTitle } from "@/lib/utils/page-title";
import { requireAuth, requireRole } from "@/lib/features/authentication/server-utils";
import { Authorization } from "@/lib/features/admin/types";
import Main from "@/src/components/experiences/classic/Layout/Main";
import MusicDepartmentMenu from "@/src/components/experiences/classic/musicDepartment/MusicDepartmentMenu";

// Allowed to block: the root layout resolves the session before this renders,
// so nothing below it can prerender until that read moves behind Suspense.
export const instant = false;

export const metadata: Metadata = {
  title: getPageTitle("Music Department"),
};

/**
 * The librarian's landing menu, reproducing `/wxycdb`'s top-level
 * `mainmenu.jsp`.
 *
 * MD-gated to match `/dashboard/library`, the catalog entry point it leads to.
 * Two of its destinations -- Missing Releases and the rotation list -- stay
 * DJ-*readable* on their own pages, and gating this menu does not tighten
 * that: both keep their own entries in the classic nav bar for every role,
 * which is where a DJ reaches them. The rotation list's write affordances
 * (Kill, Unkill, Edit, Import, Add Rotation Release) are gated to MD on that
 * page itself, independent of whether a DJ ever sees this menu -- so this
 * menu being MD-only is not what keeps a DJ from them.
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
