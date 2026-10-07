import PageHeader from "@/src/components/experiences/modern/Header/PageHeader";
import PreviousSetsSurface from "@/src/components/experiences/modern/previous-sets/PreviousSetsSurface";
import { Metadata } from "next";
import { getPageTitle } from "@/lib/utils/page-title";

export const metadata: Metadata = {
  title: getPageTitle("Previous Sets"),
};

export default function PreviousSetsPage() {
  return (
    <>
      <PageHeader title="Previous Sets" />
      <PreviousSetsSurface />
    </>
  );
}
