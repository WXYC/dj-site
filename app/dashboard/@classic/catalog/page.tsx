import { Metadata } from "next";
import { getPageTitle } from "@/lib/utils/page-title";
import Main from "@/src/components/experiences/classic/catalog/Layout/Main";
import SearchForm from "@/src/components/experiences/classic/catalog/SearchForm";
import SearchResults from "@/src/components/experiences/classic/catalog/SearchResults";

export const metadata: Metadata = {
  title: getPageTitle("Card Catalog"),
};

export default function ClassicCatalogPage() {
    return (
    <Main>
      <SearchForm />
      <SearchResults />
    </Main>
    );
  }
