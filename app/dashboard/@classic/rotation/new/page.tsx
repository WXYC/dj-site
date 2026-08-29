import { Metadata } from "next";
import { getPageTitle } from "@/lib/utils/page-title";
import { requireAuth, requireRole } from "@/lib/features/authentication/server-utils";
import { Authorization } from "@/lib/features/admin/types";
import Main from "@/src/components/experiences/classic/Layout/Main";
import RotationReleaseInsert from "@/src/components/experiences/classic/rotation/RotationReleaseInsert";

export const metadata: Metadata = {
  title: getPageTitle("Add Rotation Release"),
};

// MD-gated, though `mainmenu.jsp` does not admin-gate the "Add Rotation
// Release" link: Backend requires `catalog: ['write']` for
// `POST /library/rotation`, so an ungated page would render a full add form
// to a DJ and fail at submit. Matches `/dashboard/rotation/[id]` and
// `/dashboard/rotation/[id]/import` in `docs/architecture.md`'s URL map,
// both also MD for the same reason.
export default async function ClassicRotationInsertPage() {
  const session = await requireAuth();
  await requireRole(session, Authorization.MD);

  return (
    <Main>
      <RotationReleaseInsert />
    </Main>
  );
}
