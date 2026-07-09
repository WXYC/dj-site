"use client";

import Entry from "@/src/components/experiences/modern/flowsheet/Entries/Entry";
import FlowsheetSkeletonLoader from "@/src/components/experiences/modern/flowsheet/FlowsheetSkeletonLoader";
import { useFlowsheet } from "@/src/hooks/flowsheetHooks";
import { Table, useColorScheme } from "@mui/joy";
import { Reorder } from "motion/react";
import { useEffect, useState } from "react";

export default function FlowsheetEntries() {
  const { mode } = useColorScheme();

  const {
    loading,
    entries: { current, setCurrentShowEntries, previous },
  } = useFlowsheet();

  // Pin SSR to the skeleton: `loading` derives from RTK Query + persisted
  // auth state that diverges between the server's first render (no session,
  // no query has fired) and the client's hydration (persisted Redux session
  // already populated). Without this guard the SSR returns <Stack> (skeleton)
  // while the client hydrates <Table>, tripping React's hydration check.
  // See WXYC/dj-site#562.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || loading) {
    return <FlowsheetSkeletonLoader count={10} />;
  }

  return (
    <Table borderAxis={mode == "dark" ? "none" : "x"}>
      <thead
        style={{
          visibility: "collapse",
        }}
      >
        {/* Column sizing only (thead is collapsed): art+drag | song info | actions.
            Every row type must render exactly these 3 cells or fixed-layout
            sizing silently degrades. */}
        <tr>
          <td style={{ width: "60px" }}></td>
          <td></td>
          <td style={{ width: "140px" }}></td>
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
