import { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPageTitle } from "@/lib/utils/page-title";
import { requireAuth, requireRole } from "@/lib/features/authentication/server-utils";
import { Authorization } from "@/lib/features/admin/types";
import Main from "@/src/components/experiences/classic/Layout/Main";
import VariousArtistsCard from "@/src/components/experiences/classic/catalog/VariousArtistsCard";

export const metadata: Metadata = {
  title: getPageTitle("View an Artist Card"),
};

/**
 * Reproduces `libraryAdmin/variousArtistsCardModify.jsp`, gated to
 * `hasAdminAccess()` per `mainmenu.jsp:32-37` — the same authority the
 * ordinary artist card carries, since both are reached from the add/edit block
 * of the main menu.
 */
export default async function ClassicVariousArtistsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireAuth();
  await requireRole(session, Authorization.MD);

  const { id } = await params;
  const artistId = Number(id);
  // A non-numeric segment would otherwise reach the card as NaN and request
  // `/library/artists/NaN`, which the backend answers 400 -- rendering as
  // "this section could not be loaded" for what is really a wrong URL.
  if (!Number.isInteger(artistId) || artistId <= 0) {
    notFound();
  }

  return (
    <Main>
      <VariousArtistsCard artistId={artistId} />
    </Main>
  );
}
