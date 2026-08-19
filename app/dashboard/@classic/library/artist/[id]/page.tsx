import { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPageTitle } from "@/lib/utils/page-title";
import { requireAuth, requireRole } from "@/lib/features/authentication/server-utils";
import { Authorization } from "@/lib/features/admin/types";
import Main from "@/src/components/experiences/classic/Layout/Main";
import ArtistCard from "@/src/components/experiences/classic/catalog/ArtistCard";
import { firstSearchParam } from "@/lib/utils/search-params";

export const metadata: Metadata = {
  title: getPageTitle("View an Artist Card"),
};

/**
 * `ArtistAdminServlet:187`'s confirmation, carried onto this card after a
 * create. Selected by a flag rather than passed as text: the JSP's message is
 * a fixed server string, and taking it from the URL would let any link put
 * arbitrary words in the station's own voice at the top of a catalog screen.
 */
const CREATED_MESSAGE = "The artist/library code below has been added to the database.";

type ClassicArtistCardPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string | string[] }>;
};

/**
 * Reproduces `libraryAdmin/artistCardModify.jsp`, gated to `hasAdminAccess()`
 * per `mainmenu.jsp:32-37`.
 */
export default async function ClassicArtistCardPage({
  params,
  searchParams,
}: ClassicArtistCardPageProps) {
  const session = await requireAuth();
  await requireRole(session, Authorization.MD);

  const { id } = await params;
  const artistId = Number(id);
  // A non-numeric segment would otherwise reach the card as NaN and request
  // `/library/artists/NaN`, which the backend answers 400 -- rendering as
  // "this card could not be loaded" for what is really a wrong URL.
  if (!Number.isInteger(artistId) || artistId <= 0) {
    notFound();
  }

  const created = firstSearchParam((await searchParams).created);

  return (
    <Main>
      <ArtistCard
        artistId={artistId}
        message={created === "1" ? CREATED_MESSAGE : undefined}
      />
    </Main>
  );
}
