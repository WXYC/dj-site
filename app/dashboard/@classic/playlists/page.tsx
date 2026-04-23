import { Metadata } from "next";
import { getPageTitle } from "@/lib/utils/page-title";
import PlaylistSearchContainer from "@/src/components/experiences/modern/playlist-search/PlaylistSearchContainer";

export const metadata: Metadata = {
  title: getPageTitle("Previous Sets"),
};

export default function ClassicPreviousSetsPage() {
  return <PlaylistSearchContainer />;
}
