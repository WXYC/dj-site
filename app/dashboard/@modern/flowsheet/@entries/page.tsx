"use client";

import Entry from "@/src/components/modern/flowsheet/Entries/Entry";
import FlowsheetSkeletonLoader from "@/src/components/modern/flowsheet/FlowsheetSkeletonLoader";
import { useFlowsheet } from "@/src/hooks/flowsheetHooks";
import { Box, Stack } from "@mui/joy";
import { Reorder } from "motion/react";

export default function FlowsheetEntries() {
  const {
    loading,
    entries: { current, setCurrentShowEntries, previous },
  } = useFlowsheet();

  if (loading) {
    return <FlowsheetSkeletonLoader count={10} />;
  }

  return (
    <Stack spacing={0.5}>
      <Reorder.Group
        values={current}
        axis="y"
        onReorder={() => {}} // Disabled for now
        as="div"
        style={{ display: "flex", flexDirection: "column", gap: "4px" }}
      >
        {current.map((entry, index) => (
          <Entry key={entry.id} entry={entry} playing={index == 0} />
        ))}
        {previous.map((entry, index) => (
          <Entry
            key={entry.id}
            entry={entry}
            playing={index == 0 && current.length == 0}
          />
        ))}
      </Reorder.Group>
    </Stack>
  );
}
