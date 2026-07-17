
import PageHeader from "@/src/components/experiences/modern/Header/PageHeader";
import MobileSearchBar from "@/src/components/experiences/modern/catalog/Search/MobileSearchBar";
import SearchBar from "@/src/components/experiences/modern/catalog/Search/SearchBar";
import Results from "@/src/components/experiences/modern/catalog/Results/Results";
import AddReleasePanel from "@/src/components/experiences/modern/catalog/AddRelease/AddReleasePanel";
import ArtistAddPanel from "@/src/components/experiences/modern/catalog/ArtistAddPanel";
import { getCachedGenres } from "@/lib/features/catalog/server";
import { Metadata } from "next";
import { getPageTitle } from "@/lib/utils/page-title";

// Allowed to block: the root layout resolves the session before this renders,
// so nothing below it can prerender until that read moves behind Suspense.
export const instant = false;

export const metadata: Metadata = {
  title: getPageTitle("Card Catalog"),
};

export default async function CatalogPage() {
  // Seed the desktop Filters' genre list from the server cache so the
  // autocomplete has options on first paint; the client query still owns the
  // value once it resolves. Cached accessor is argument-pure (no request state),
  // so it composes with this auth-gated route.
  const initialGenres = await getCachedGenres();

  return (
    <>
      <PageHeader title="Card Catalog">
        <ArtistAddPanel />
        <AddReleasePanel />
      </PageHeader>
      <>
        <MobileSearchBar color="primary" />
        <SearchBar color="primary" initialGenres={initialGenres} />
        <Results color="primary" />
      </>
    </>
  );
}
