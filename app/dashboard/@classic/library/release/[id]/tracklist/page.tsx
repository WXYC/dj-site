import { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPageTitle } from "@/lib/utils/page-title";
import { requireAuth, requireRole } from "@/lib/features/authentication/server-utils";
import { Authorization } from "@/lib/features/admin/types";
import Main from "@/src/components/experiences/classic/Layout/Main";
import ReleaseTracklistEditor from "@/src/components/experiences/classic/catalog/ReleaseTracklistEditor";

export const metadata: Metadata = {
  title: getPageTitle("Modify a Library Release Card: Enter Per-Track Artist Credits"),
};

type ClassicReleaseTracklistPageProps = {
  params: Promise<{ id: string }>;
};

/**
 * Per-track artist credit entry for a Various Artists release — reached from
 * the release editor's tracklist section. No JSP renders this screen:
 * `libraryReleaseModify.jsp`'s tracklist is read-only, so tubafrenzy never
 * gave a librarian a way to enter these credits at all. See
 * `ReleaseTracklistEditor` for the full account of what fills that gap.
 *
 * Gated to the same tier as the editor and its `/move` and `/delete`
 * siblings: filing a per-track credit is a catalog write like any other, and
 * Backend requires `catalog: ['write']` for the POST that carries it.
 */
export default async function ClassicReleaseTracklistPage({
  params,
}: ClassicReleaseTracklistPageProps) {
  const session = await requireAuth();
  await requireRole(session, Authorization.MD);

  const { id } = await params;
  const albumId = Number(id);
  // A non-numeric segment would otherwise reach the editor as NaN and request
  // `/library/info?album_id=NaN`, rendering a load failure for what is really
  // a wrong URL. Matches the editor's own guard.
  if (!Number.isInteger(albumId) || albumId <= 0) {
    notFound();
  }

  return (
    <Main>
      <ReleaseTracklistEditor albumId={albumId} />
    </Main>
  );
}
