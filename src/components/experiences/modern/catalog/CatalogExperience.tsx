"use client";

import PageHeader from "@/src/components/experiences/modern/Header/PageHeader";
import MobileSearchBar from "@/src/components/experiences/modern/catalog/Search/MobileSearchBar";
import SearchBar from "@/src/components/experiences/modern/catalog/Search/SearchBar";
import Results from "@/src/components/experiences/modern/catalog/Results/Results";
import CatalogEditMenu from "./CatalogEditMenu";

export default function CatalogExperience() {
  return (
    <>
      <PageHeader title="Card Catalog">
        <CatalogEditMenu />
      </PageHeader>
      <MobileSearchBar color="primary" />
      <SearchBar color="primary" />
      <Results color="primary" />
    </>
  );
}
