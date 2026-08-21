import { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPageTitle } from "@/lib/utils/page-title";
import { requireAuth, requireRole } from "@/lib/features/authentication/server-utils";
import { Authorization } from "@/lib/features/admin/types";
import Main from "@/src/components/experiences/classic/Layout/Main";
import ReleaseCard from "@/src/components/experiences/classic/catalog/ReleaseCard";

export const metadata: Metadata = {
  title: getPageTitle("Modify a Library Release Card"),
};

type ClassicReleasePageProps = {
  params: Promise<{ id: string }>;
};

/**
 * Reproduces `libraryAdmin/libraryReleaseModify.jsp` — the screen a catalog
 * result's release title opens.
 *
 * Admin-gated to match: the JSP renders under `body class="library-admin"` and
 * every action on it is a librarian action. Catalog search is DJ-facing, so a
 * DJ who follows a result row's release title lands on a screen they cannot
 * open — which is what the legacy interface does too. An ungated read-only
 * release view for DJs is a different screen, not a relaxation of this gate.
 */
export default async function ClassicReleasePage({
  params,
}: ClassicReleasePageProps) {
  const session = await requireAuth();
  await requireRole(session, Authorization.MD);

  const { id } = await params;
  const albumId = Number(id);
  // A non-numeric segment would otherwise reach the card as NaN and request
  // `/library/info?album_id=NaN`, rendering a load failure for what is really
  // a wrong URL. Matches the artist card's guard.
  if (!Number.isInteger(albumId) || albumId <= 0) {
    notFound();
  }

  return (
    <Main>
      <ReleaseCard albumId={albumId} />
    </Main>
  );
}
