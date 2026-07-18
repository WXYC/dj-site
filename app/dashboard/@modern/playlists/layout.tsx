import PageHeader from "@/src/components/experiences/modern/Header/PageHeader";
import SearchBar from "@/src/components/experiences/modern/previous-sets/Search/SearchBar";
import Results from "@/src/components/experiences/modern/previous-sets/Results/Results";
import { Metadata } from "next";
import { getPageTitle } from "@/lib/utils/page-title";

export const metadata: Metadata = {
  title: getPageTitle("Previous Sets"),
};

// The previous-sets UI lives in the layout so the nested album/[id] segment
// renders the detail card while the page stays visible behind it.
export default function PreviousSetsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <PageHeader title="Previous Sets" />
      <SearchBar />
      <Results />
      {children}
    </>
  );
}
