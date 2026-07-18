import PageHeader from "@/src/components/experiences/modern/Header/PageHeader";
import MobileSearchBar from "@/src/components/experiences/modern/catalog/Search/MobileSearchBar";
import SearchBar from "@/src/components/experiences/modern/catalog/Search/SearchBar";
import Results from "@/src/components/experiences/modern/catalog/Results/Results";
import { Metadata } from "next";
import { getPageTitle } from "@/lib/utils/page-title";

export const metadata: Metadata = {
  title: getPageTitle("Card Catalog"),
};

// The catalog UI lives in the layout so the nested album/[id] segment renders
// the detail card while the catalog stays visible behind it.
export default function CatalogLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <PageHeader title="Card Catalog" />
      <>
        <MobileSearchBar color="primary" />
        <SearchBar color="primary" />
        <Results color="primary" />
      </>
      {children}
    </>
  );
}
