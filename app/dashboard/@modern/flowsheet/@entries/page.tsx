"use client";

import Entry from "@/src/components/experiences/modern/flowsheet/Entries/Entry";
import FlowsheetSkeletonLoader from "@/src/components/experiences/modern/flowsheet/FlowsheetSkeletonLoader";
import { useFlowsheet } from "@/src/hooks/flowsheetHooks";
import { Table, useColorScheme } from "@mui/joy";
import { Reorder } from "motion/react";

export default function FlowsheetEntries() {
  const { mode } = useColorScheme();

  const {
    loading,
    entries: { current, previous },
  } = useFlowsheet();

  if (loading) {
    return <FlowsheetSkeletonLoader count={10} />;
  }

  return (
    <Table borderAxis={mode == "dark" ? "none" : "x"}>
      <thead
        style={{
          visibility: "collapse",
        }}
      >
        <tr>
          <td
            style={{
              width: "60px",
            }}
          ></td>
          <td></td>
          <td></td>
          <td></td>
          <td></td>
          <td></td>
          <td></td>
        </tr>
      </thead>
      <Reorder.Group
        values={current}
        axis="y"
        onReorder={() => {}} // Disabled for now
        as="tbody"
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
    </Table>
  );
}
