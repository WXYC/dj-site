
import PageHeader from "@/src/components/experiences/modern/Header/PageHeader";
import MobileSearchBar from "@/src/components/experiences/modern/catalog/Search/MobileSearchBar";
import SearchBar from "@/src/components/experiences/modern/catalog/Search/SearchBar";
import Results from "@/src/components/experiences/modern/catalog/Results/Results";
import { getCachedGenres } from "@/lib/features/catalog/server";
import { Metadata } from "next";
import { getPageTitle } from "@/lib/utils/page-title";

export const metadata: Metadata = {
  title: getPageTitle("Card Catalog"),
};

export default async function CatalogPage() {
  // Seed the Filters' genre list from the server cache so the autocomplete has
  // options on first paint; the client query still owns the value once it
  // resolves. `undefined` on failure keeps the client loading affordance. The
  // cached accessor is argument-pure (no request state), so it composes with
  // this auth-gated route.
  const initialGenres = await getCachedGenres();

  return (
    <>
      <PageHeader title="Card Catalog" />
      <>
        <MobileSearchBar color="primary" initialGenres={initialGenres} />
        <SearchBar color="primary" initialGenres={initialGenres} />
        <Results color="primary" />
      </>
    </>
  );
}
