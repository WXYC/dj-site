
import PageHeader from "@/src/components/modern/Header/PageHeader.";
import MobileSearchBar from "@/src/components/modern/catalog/Search/MobileSearchBar";
import SearchBar from "@/src/components/modern/catalog/Search/SearchBar";
import Results from "@/src/components/modern/catalog/Results/Results";

export default function CatalogPage() {
  return (
    <>
      <PageHeader title="Card Catalog" />
      <>
        <MobileSearchBar color="primary" />
        <SearchBar color="primary" />
        <Results color="primary" />
      </>
    </>
  );
}
