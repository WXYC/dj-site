import { Metadata } from "next";
import { getPageTitle } from "@/lib/utils/page-title";
import { requireAuth, requireRole } from "@/lib/features/authentication/server-utils";
import { Authorization } from "@/lib/features/admin/types";
import Main from "@/src/components/experiences/classic/Layout/Main";
import MissingReleases from "@/src/components/experiences/classic/library/MissingReleases";

export const metadata: Metadata = {
  title: getPageTitle("Missing Releases"),
};

// Gated at authenticated-DJ, never MD: mainmenu.jsp places Missing Releases
// outside its hasAdminAccess() block and Backend gates PATCH
// /library/:id/missing|found at catalog:['read'] so any DJ can flag a stack
// missing/found while pulling records (BS#393). Marking a stack missing or
// found is a status toggle done by whoever is standing at the stacks, not a
// catalog-write action.
export default async function ClassicMissingReleasesPage() {
  const session = await requireAuth();
  await requireRole(session, Authorization.DJ);

  return (
    <Main>
      <MissingReleases />
    </Main>
  );
}
