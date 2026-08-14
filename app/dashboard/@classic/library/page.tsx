import { Metadata } from "next";
import { getPageTitle } from "@/lib/utils/page-title";
import { requireAuth, requireRole } from "@/lib/features/authentication/server-utils";
import { Authorization } from "@/lib/features/admin/types";
import Main from "@/src/components/experiences/classic/Layout/Main";
import ArtistSearchForm from "@/src/components/experiences/classic/catalog/ArtistSearchForm";
import NewArtistForm from "@/src/components/experiences/classic/catalog/NewArtistForm";

export const metadata: Metadata = {
  title: getPageTitle("Find an Artist"),
};

/**
 * Reproduces `chooseLibraryCodeOrArtist.jsp`: the classic catalog's
 * artist-vs-Various-Artists entry point, gated to `hasAdminAccess()` in the
 * JSP's `mainmenu.jsp`.
 */
export default async function LibraryPage() {
  const session = await requireAuth();
  await requireRole(session, Authorization.MD);

  return (
    <Main>
      <ArtistSearchForm />
      <hr />
      <NewArtistForm />
    </Main>
  );
}
