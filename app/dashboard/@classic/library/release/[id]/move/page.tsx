import { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPageTitle } from "@/lib/utils/page-title";
import { requireAuth, requireRole } from "@/lib/features/authentication/server-utils";
import { Authorization } from "@/lib/features/admin/types";
import Main from "@/src/components/experiences/classic/Layout/Main";
import ReleaseMoveForm from "@/src/components/experiences/classic/catalog/ReleaseMoveForm";

export const metadata: Metadata = {
  title: getPageTitle("Modify a Library Release Card: Move to a Different Library Code"),
};

type ClassicReleaseMovePageProps = {
  params: Promise<{ id: string }>;
};

/**
 * Reproduces `libraryAdmin/libraryReleaseModifyLibCode.jsp` — reached from the
 * release editor's "Change the Library Code of This Library Release".
 *
 * Gated to the same tier as the editor: re-filing a release is a catalog write
 * like any other, and Backend requires `catalog: ['write']` for the PATCH that
 * carries it.
 */
export default async function ClassicReleaseMovePage({
  params,
}: ClassicReleaseMovePageProps) {
  const session = await requireAuth();
  await requireRole(session, Authorization.MD);

  const { id } = await params;
  const albumId = Number(id);
  // A non-numeric segment would otherwise reach the form as NaN and offer a
  // move for a release that cannot exist. Matches the editor's guard.
  if (!Number.isInteger(albumId) || albumId <= 0) {
    notFound();
  }

  return (
    <Main>
      <ReleaseMoveForm albumId={albumId} />
    </Main>
  );
}
