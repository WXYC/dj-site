import PageHeader from "@/src/components/experiences/modern/Header/PageHeader";
import SearchBar from "@/src/components/experiences/modern/previous-sets/Search/SearchBar";
import Results from "@/src/components/experiences/modern/previous-sets/Results/Results";
import { fetchRecentPlaylistsSeed } from "@/lib/features/playlist-search/server";
import { Metadata } from "next";
import { getPageTitle } from "@/lib/utils/page-title";

export const metadata: Metadata = {
  title: getPageTitle("Previous Sets"),
};

export default async function PreviousSetsPage() {
  // The default listing is the same public, request-time-knowable first page
  // the client query asks for, so rendering it here puts populated rows in the
  // initial HTML. Fails soft to an empty seed; the client query then fills in.
  const { results } = await fetchRecentPlaylistsSeed();

  return (
    <>
      <PageHeader title="Previous Sets" />
      <SearchBar />
      <Results initialResults={results} />
    </>
  );
}
