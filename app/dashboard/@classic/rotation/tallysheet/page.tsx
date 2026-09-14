import { Metadata } from "next";
import { getPageTitle } from "@/lib/utils/page-title";
import { requireAuth, requireRole } from "@/lib/features/authentication/server-utils";
import { Authorization } from "@/lib/features/admin/types";
import Main from "@/src/components/experiences/classic/Layout/Main";
import RotationTallysheet from "@/src/components/experiences/classic/rotation/RotationTallysheet";

export const metadata: Metadata = {
  title: getPageTitle("Format Tallysheets"),
};

// Gated at authenticated-DJ, never MD. `mainmenu.jsp:40` places Format
// Tallysheets outside its hasAdminAccess() block -- unlike Manage Labels and
// both cross-reference views on the lines above it -- so the summary is
// DJ-readable in the original and is not tightened here. The write halves that
// would need MD (recalculate, hand-correct, kill) are not built.
export default async function ClassicRotationTallysheetPage() {
  const session = await requireAuth();
  await requireRole(session, Authorization.DJ);

  return (
    <Main>
      <RotationTallysheet />
    </Main>
  );
}
