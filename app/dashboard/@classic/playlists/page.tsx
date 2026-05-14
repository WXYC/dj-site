import { Metadata } from "next";
import { getPageTitle } from "@/lib/utils/page-title";
import { PreviousSetsContainer } from "@/src/components/experiences/classic/playlists";

export const metadata: Metadata = {
  title: getPageTitle("Previous Sets"),
};

export default function ClassicPreviousSetsPage() {
  return <PreviousSetsContainer />;
}
