"use client";

import Entry from "@/src/components/modern/flowsheet/Entries/Entry";
import FlowsheetSkeletonLoader from "@/src/components/modern/flowsheet/FlowsheetSkeletonLoader";
import { useFlowsheet } from "@/src/hooks/flowsheetHooks";
import { Stack } from "@mui/joy";

export default function FlowsheetEntries() {
  const { loading, entries } = useFlowsheet();

  if (loading || !entries) {
    return <FlowsheetSkeletonLoader count={8} />;
  }

  return (
    <Stack direction="column" spacing={1}>
      {entries.map((entry, index) => (
        <Entry key={entry.id} entry={entry} playing={index == 0} />
      ))}
    </Stack>
  );
}
