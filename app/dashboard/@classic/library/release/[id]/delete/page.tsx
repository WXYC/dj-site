import { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPageTitle } from "@/lib/utils/page-title";
import { requireAuth, requireRole } from "@/lib/features/authentication/server-utils";
import { Authorization } from "@/lib/features/admin/types";
import Main from "@/src/components/experiences/classic/Layout/Main";
import ReleaseDeleteConfirm from "@/src/components/experiences/classic/catalog/ReleaseDeleteConfirm";

export const metadata: Metadata = {
  title: getPageTitle("Delete a Library Release"),
};

type ClassicReleaseDeletePageProps = {
  params: Promise<{ id: string }>;
};

/**
 * Reproduces `libraryAdmin/libraryReleaseDelete.jsp` and its
 * `libraryReleaseDeleted.jsp` aftermath — reached from the release editor's
 * "Delete This Library Release".
 *
 * Gated to the same tier as the editor it is reached from, not a higher one.
 * The delete is irreversible, which argues for a stricter bar, but the
 * refusal that actually protects the catalog is server-side: Backend declines
 * to delete a release carrying flowsheet plays no matter who asks. Raising the
 * bar here would only move which librarian can do the safe deletions.
 */
export default async function ClassicReleaseDeletePage({
  params,
}: ClassicReleaseDeletePageProps) {
  const session = await requireAuth();
  await requireRole(session, Authorization.MD);

  const { id } = await params;
  const albumId = Number(id);
  // A non-numeric segment would otherwise reach the card as NaN and offer a
  // delete for a release that cannot exist. Matches the editor's guard.
  if (!Number.isInteger(albumId) || albumId <= 0) {
    notFound();
  }

  return (
    <Main>
      <ReleaseDeleteConfirm albumId={albumId} />
    </Main>
  );
}
