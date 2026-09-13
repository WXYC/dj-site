import { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPageTitle } from "@/lib/utils/page-title";
import { requireAuth, requireRole } from "@/lib/features/authentication/server-utils";
import { Authorization } from "@/lib/features/admin/types";
import Main from "@/src/components/experiences/classic/Layout/Main";
import RotationReleaseModify from "@/src/components/experiences/classic/rotation/RotationReleaseModify";

export const metadata: Metadata = {
  title: getPageTitle("Modify Rotation Release"),
};

type ClassicRotationModifyPageProps = {
  params: Promise<{ id: string }>;
};

/**
 * Reproduces `rotationReleaseModify.jsp` — reached from the Edit link on a row
 * of the rotation release list.
 *
 * MD-gated like the rest of the rotation write surface, and unlike the
 * DJ-readable list it is reached from: `mainmenu.jsp` does not admin-gate the
 * rotation links, but Backend requires `catalog: ['write']` for every rotation
 * write, so an ungated page would render a full edit form to a DJ and fail at
 * submit.
 */
export default async function ClassicRotationModifyPage({ params }: ClassicRotationModifyPageProps) {
  const session = await requireAuth();
  await requireRole(session, Authorization.MD);

  const { id } = await params;
  const rotationId = Number(id);
  // A non-numeric segment would otherwise reach the screen as NaN and offer to
  // edit a rotation release that cannot exist. Matches the import screen's guard.
  if (!Number.isInteger(rotationId) || rotationId <= 0) {
    notFound();
  }

  return (
    <Main>
      {/* Keyed so navigating between two rotation releases remounts the editor
          rather than leaving the previous row's unsaved edits in its fields. */}
      <RotationReleaseModify key={rotationId} rotationId={rotationId} />
    </Main>
  );
}
