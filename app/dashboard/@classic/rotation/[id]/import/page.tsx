import { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPageTitle } from "@/lib/utils/page-title";
import { requireAuth, requireRole } from "@/lib/features/authentication/server-utils";
import { Authorization } from "@/lib/features/admin/types";
import Main from "@/src/components/experiences/classic/Layout/Main";
import RotationImportScreen from "@/src/components/experiences/classic/rotation/RotationImportScreen";

export const metadata: Metadata = {
  title: getPageTitle("Import Rotation Release to Library"),
};

type ClassicRotationImportPageProps = {
  params: Promise<{ id: string }>;
};

/**
 * Reproduces `rotationReleaseImport.jsp` — reached from the Import link on an
 * uncatalogued row of the rotation release list.
 *
 * MD-gated like the rest of the rotation write surface, and unlike the
 * DJ-readable list this screen is reached from: cataloging a rotation release
 * creates a library release and links the rotation row, and Backend requires
 * `catalog: ['write']` for both.
 */
export default async function ClassicRotationImportPage({ params }: ClassicRotationImportPageProps) {
  const session = await requireAuth();
  await requireRole(session, Authorization.MD);

  const { id } = await params;
  const rotationId = Number(id);
  // A non-numeric segment would otherwise reach the screen as NaN and offer
  // to catalog a rotation release that cannot exist. Matches the release
  // editor's guard.
  if (!Number.isInteger(rotationId) || rotationId <= 0) {
    notFound();
  }

  return (
    <Main>
      <RotationImportScreen rotationId={rotationId} />
    </Main>
  );
}
