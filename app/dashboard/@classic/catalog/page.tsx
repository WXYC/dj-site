import { Metadata } from "next";
import { cookies } from "next/headers";
import { getPageTitle } from "@/lib/utils/page-title";
import { requireAuth, checkRole } from "@/lib/features/authentication/server-utils";
import { Authorization } from "@/lib/features/admin/types";
import Main from "@/src/components/experiences/classic/Layout/Main";
import SearchForm from "@/src/components/experiences/classic/catalog/SearchForm";
import SearchResults from "@/src/components/experiences/classic/catalog/SearchResults";

export const metadata: Metadata = {
  title: getPageTitle("Card Catalog"),
};

// Authenticated but never role-gated: `searchCardCatalog` carries no authority
// check of its own, and this is classic's DJ-facing search screen, so an MD
// gate here would bounce every DJ who ran a search.
//
// Authority decides only which artist card a result row links to --
// `LibraryCatalogServlet.goToArtistModifyCard` makes that same split, sending
// an admin to the card that can add a release and everyone else to the
// read-only one. It resolves here, once, because the row is rendered by a
// client component that would otherwise have to buy the station role with a
// round trip of its own.
export default async function ClassicCatalogPage() {
  const session = await requireAuth();
  const canModify = await checkRole(session, Authorization.MD, (await cookies()).toString());

  return (
    <Main>
      <SearchForm />
      <SearchResults canModify={canModify} />
    </Main>
  );
}
