"use client";

import { FlowsheetSearchProvider } from "@/src/components/experiences/modern/flowsheet/Search/FlowsheetSearchProvider";
import SmartEntry from "@/src/components/experiences/modern/flowsheet/SmartEntry/SmartEntry";

export default function FlowsheetSearch() {
  return (
    <FlowsheetSearchProvider>
      <SmartEntry />
    </FlowsheetSearchProvider>
  );
}
