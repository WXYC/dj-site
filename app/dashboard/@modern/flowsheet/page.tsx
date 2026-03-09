import { Metadata } from "next";
import { getPageTitle } from "@/lib/utils/page-title";
import FlowsheetSearch from "./flowsheet-search";

export const metadata: Metadata = {
  title: getPageTitle("Flowsheet"),
};

export default function FlowsheetPage() {
  return <FlowsheetSearch />;
}
