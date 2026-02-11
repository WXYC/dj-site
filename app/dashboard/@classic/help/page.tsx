import { Metadata } from "next";
import { getPageTitle } from "@/lib/utils/page-title";
import HelpScreen from "@/src/components/experiences/classic/flowsheet/HelpScreen";

export const metadata: Metadata = {
  title: getPageTitle("Help"),
};

export default function ClassicHelpPage() {
  return <HelpScreen />;
}
