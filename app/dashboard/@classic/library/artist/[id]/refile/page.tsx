import { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPageTitle } from "@/lib/utils/page-title";
import { requireAuth, requireRole } from "@/lib/features/authentication/server-utils";
import { Authorization } from "@/lib/features/admin/types";
import Main from "@/src/components/experiences/classic/Layout/Main";
import ArtistRefileForm from "@/src/components/experiences/classic/catalog/ArtistRefileForm";
import { artistCardGenreIdOrNotFound } from "@/lib/features/catalog/artistCardRoute.server";

export const metadata: Metadata = {
  title: getPageTitle("Change The Artist Call Letters, Number Or Genre"),
};

type ClassicArtistRefilePageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ genre_id?: string | string[] }>;
};

/**
 * Re-files an artist's call letters, number or genre (`POST
 * /library/artists/:id/refile`), reached from the artist card's "Change" link.
 * `genre_id` is required: it names which of the artist's shelves is being
 * moved, so a link that names none has nothing to re-file.
 */
export default async function ClassicArtistRefilePage({
  params,
  searchParams,
}: ClassicArtistRefilePageProps) {
  const session = await requireAuth();
  await requireRole(session, Authorization.MD);

  const { id } = await params;
  const artistId = Number(id);
  if (!Number.isInteger(artistId) || artistId <= 0) {
    notFound();
  }

  const search = await searchParams;
  const genreId = artistCardGenreIdOrNotFound(search.genre_id);
  if (genreId === undefined) {
    notFound();
  }

  return (
    <Main>
      <ArtistRefileForm artistId={artistId} genreId={genreId} />
    </Main>
  );
}
