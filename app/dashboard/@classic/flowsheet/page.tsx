import { Metadata } from "next";
import { getPageTitle } from "@/lib/utils/page-title";
import Main from "@/src/components/experiences/classic/flowsheet/Layout/Main";

export const metadata: Metadata = {
  title: getPageTitle("Flowsheet"),
};

export default function ClassicFlowsheetPage() {
  return <Main />;
}
