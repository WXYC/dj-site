import { Metadata } from "next";
import { getPageTitle } from "@/lib/utils/page-title";
import { ClassicPreviousSetsSurface } from "@/src/components/experiences/classic/playlists";
import { fetchRecentPlaylistsSeed } from "@/lib/features/playlist-search/server";

export const metadata: Metadata = {
  title: getPageTitle("Previous Sets"),
};

export default async function ClassicPreviousSetsPage() {
  // See the Modern page: the seed is the client query's own first page, so the
  // initial HTML carries rows instead of an empty table.
  const { results } = await fetchRecentPlaylistsSeed();

  return <ClassicPreviousSetsSurface initialResults={results} />;
}
