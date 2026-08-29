import { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPageTitle } from "@/lib/utils/page-title";
import { requireAuth, requireRole } from "@/lib/features/authentication/server-utils";
import { Authorization } from "@/lib/features/admin/types";
import Main from "@/src/components/experiences/classic/Layout/Main";
import { firstSearchParam } from "@/lib/utils/search-params";
import VariousArtistsCard from "@/src/components/experiences/classic/catalog/VariousArtistsCard";

export const metadata: Metadata = {
  title: getPageTitle("View an Artist Card"),
};

/**
 * `ArtistAdminServlet:187`'s confirmation, carried onto this card after a
 * create — a compilation code is created through the same chooser as any
 * other, and routes here rather than to the artist card. Selected by a flag
 * rather than passed as text, for the reason the artist card page states: the
 * JSP's message is a fixed server string, and taking it from the URL would let
 * any link put arbitrary words in the station's own voice.
 */
const CREATED_MESSAGE = "The artist/library code below has been added to the database.";

/**
 * Reproduces `libraryAdmin/variousArtistsCardModify.jsp`, gated to
 * `hasAdminAccess()` per `mainmenu.jsp:32-37` — the same authority the
 * ordinary artist card carries, since both are reached from the add/edit block
 * of the main menu.
 */
export default async function ClassicVariousArtistsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string | string[] }>;
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

  const created = firstSearchParam((await searchParams).created);

  return (
    <Main>
      <VariousArtistsCard
        artistId={artistId}
        message={created === "1" ? CREATED_MESSAGE : undefined}
      />
    </Main>
  );
}
