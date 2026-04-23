import PageHeader from "@/src/components/experiences/modern/Header/PageHeader";
import SearchBar from "@/src/components/experiences/modern/previous-sets/Search/SearchBar";
import Results from "@/src/components/experiences/modern/previous-sets/Results/Results";
import { Metadata } from "next";
import { getPageTitle } from "@/lib/utils/page-title";

export const metadata: Metadata = {
  title: getPageTitle("Previous Sets"),
};

export default function PreviousSetsPage() {
  return (
    <>
      <PageHeader title="Previous Sets" />
      <SearchBar />
      <Results />
    </>
  );
}
