"use client";

import FlowsheetSearchbar from "@/src/components/experiences/modern/flowsheet/Search/FlowsheetSearchbar";
import { FlowsheetSearchProvider } from "@/src/components/experiences/modern/flowsheet/Search/FlowsheetSearchProvider";

export default function FlowsheetSearch() {
  return (
    <FlowsheetSearchProvider>
      <FlowsheetSearchbar />
    </FlowsheetSearchProvider>
  );
}
