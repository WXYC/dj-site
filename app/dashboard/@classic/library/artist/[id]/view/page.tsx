import { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPageTitle } from "@/lib/utils/page-title";
import { requireAuth } from "@/lib/features/authentication/server-utils";
import Main from "@/src/components/experiences/classic/Layout/Main";
import ArtistCardView from "@/src/components/experiences/classic/catalog/ArtistCardView";
import { parseArtistCardGenreId } from "@/lib/features/catalog/artistCardRoute";

export const metadata: Metadata = {
  title: getPageTitle("View an Artist Card"),
};

type ClassicArtistViewPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ genre_id?: string | string[] }>;
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
  searchParams,
}: ClassicArtistViewPageProps) {
  await requireAuth();

  const { id } = await params;
  const artistId = Number(id);
  if (!Number.isInteger(artistId) || artistId <= 0) {
    notFound();
  }

  const search = await searchParams;
  // A malformed `genre_id` is a broken link, the same class of wrong URL as a
  // non-numeric id segment, and gets the same answer. Falling back to the
  // unscoped read instead would quietly serve the collapsed card -- one shelf's
  // code over every shelf's releases -- which is the symptom the parameter
  // exists to prevent.
  const genreId = parseArtistCardGenreId(search.genre_id);
  if (genreId === null) {
    notFound();
  }

  return (
    <Main>
      <ArtistCardView artistId={artistId} genreId={genreId} />
    </Main>
  );
}
