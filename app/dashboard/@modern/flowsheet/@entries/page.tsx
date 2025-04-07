"use client";

import Entry from "@/src/components/modern/flowsheet/Entries/Entry";
import FlowsheetSkeletonLoader from "@/src/components/modern/flowsheet/FlowsheetSkeletonLoader";
import { useFlowsheet } from "@/src/hooks/flowsheetHooks";
import { Table, useColorScheme } from "@mui/joy";

export default function FlowsheetEntries() {
  const { mode } = useColorScheme();

  const { loading, entries } = useFlowsheet();

  if (loading || !entries) {
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
            width: "60px"
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
      <tbody>
        {entries.map((entry, index) => (
          <Entry key={entry.id} entry={entry} playing={index == 0} />
        ))}
      </tbody>
    </Table>
  );
}
