import { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPageTitle } from "@/lib/utils/page-title";
import { requireAuth } from "@/lib/features/authentication/server-utils";
import Main from "@/src/components/experiences/classic/Layout/Main";
import ArtistCardView from "@/src/components/experiences/classic/catalog/ArtistCardView";

export const metadata: Metadata = {
  title: getPageTitle("View an Artist Card"),
};

type ClassicArtistViewPageProps = {
  params: Promise<{ id: string }>;
};

/**
 * Reproduces `lucene/artistCardDisplay.jsp` — the destination a catalog result
 * row's artist name opens (`artist?id=…&mode=view`).
 *
 * Authenticated but NOT role-gated, deliberately, and unlike the sibling modify
 * card: the JSP carries no role check, and catalog search is the DJ-facing
 * screen in classic, so gating here would bounce every DJ who clicked an artist.
 */
export default async function ClassicArtistViewPage({
  params,
}: ClassicArtistViewPageProps) {
  await requireAuth();

  const { id } = await params;
  const artistId = Number(id);
  if (!Number.isInteger(artistId) || artistId <= 0) {
    notFound();
  }

  return (
    <Main>
      <ArtistCardView artistId={artistId} />
    </Main>
  );
}
