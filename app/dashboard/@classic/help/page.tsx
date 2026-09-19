import { Metadata } from "next";
import { getPageTitle } from "@/lib/utils/page-title";
import HelpScreen from "@/src/components/experiences/classic/flowsheet/HelpScreen";

// Allowed to block: the root layout resolves the session before this renders,
// so nothing below it can prerender until that read moves behind Suspense.
export const instant = false;

export const metadata: Metadata = {
  title: getPageTitle("Help"),
};

export default function ClassicHelpPage() {
  return <HelpScreen />;
}
