import { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPageTitle } from "@/lib/utils/page-title";
import { requireAuth, requireRole } from "@/lib/features/authentication/server-utils";
import { Authorization } from "@/lib/features/admin/types";
import Main from "@/src/components/experiences/classic/Layout/Main";
import ArtistDeleteConfirm from "@/src/components/experiences/classic/catalog/ArtistDeleteConfirm";

export const metadata: Metadata = {
  title: getPageTitle("Delete The Artist"),
};

type ClassicArtistDeletePageProps = {
  params: Promise<{ id: string }>;
};

/**
 * Reproduces `ArtistAdminServlet`'s delete branch -- reached from the artist
 * card's "Delete The Artist" link. Gated to the same tier as that card, not
 * a higher one: the refusal that actually protects the shelf is server-side
 * (`DELETE /library/artists/:id` 409s on any of four dependent counts).
 */
export default async function ClassicArtistDeletePage({
  params,
}: ClassicArtistDeletePageProps) {
  const session = await requireAuth();
  await requireRole(session, Authorization.MD);

  const { id } = await params;
  const artistId = Number(id);
  // A non-numeric segment would otherwise reach the screen as NaN and
  // request `/library/artists/NaN`, which the backend answers 400. Matches
  // the card's own guard.
  if (!Number.isInteger(artistId) || artistId <= 0) {
    notFound();
  }

  return (
    <Main>
      <ArtistDeleteConfirm artistId={artistId} />
    </Main>
  );
}
