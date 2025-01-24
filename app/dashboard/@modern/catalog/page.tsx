import PageHeader from "../components/Header/PageHeader.";
import Results from "./components/Results/Results";
import MobileSearchBar from "./components/Search/MobileSearchBar";
import SearchBar from "./components/Search/SearchBar";

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
