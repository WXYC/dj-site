
import PageHeader from "@/src/components/experiences/modern/Header/PageHeader";
import MobileSearchBar from "@/src/components/experiences/modern/catalog/Search/MobileSearchBar";
import SearchBar from "@/src/components/experiences/modern/catalog/Search/SearchBar";
import Results from "@/src/components/experiences/modern/catalog/Results/Results";
import AddReleasePanel from "@/src/components/experiences/modern/catalog/AddRelease/AddReleasePanel";
import { Metadata } from "next";
import { getPageTitle } from "@/lib/utils/page-title";

export const metadata: Metadata = {
  title: getPageTitle("Card Catalog"),
};

export default function CatalogPage() {
  return (
    <>
      <PageHeader title="Card Catalog">
        <AddReleasePanel />
      </PageHeader>
      <>
        <MobileSearchBar color="primary" />
        <SearchBar color="primary" />
        <Results color="primary" />
      </>
    </>
  );
}
