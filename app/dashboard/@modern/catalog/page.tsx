
import CatalogExperience from "@/src/components/experiences/modern/catalog/CatalogExperience";
import { Metadata } from "next";
import { getPageTitle } from "@/lib/utils/page-title";

export const metadata: Metadata = {
  title: getPageTitle("Card Catalog"),
};

export default function CatalogPage() {
  return <CatalogExperience />;
}
