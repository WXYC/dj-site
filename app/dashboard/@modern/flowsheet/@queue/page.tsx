"use client";

import { useAppSelector } from "@/lib/hooks";
import SongEntry from "@/src/components/experiences/modern/flowsheet/Entries/SongEntry/SongEntry";
import { Table, useColorScheme } from "@mui/joy";
import { Reorder } from "motion/react";
import { useCallback, useEffect, useState } from "react";

export default function Queue() {
  const { mode } = useColorScheme();
  const queue = useAppSelector((state) => state.flowsheet.queue);
  const [isMounted, setIsMounted] = useState(false);

  // Only render queue content after client-side mount to avoid hydration mismatch
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Handler for reordering queue items - Disabled for now
  const handleReorder = useCallback((_newOrder: typeof queue) => {
    // Reordering disabled
  }, []);

  return (
    <Table borderAxis={mode == "dark" ? "x" : "x"} variant="soft">
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
        values={isMounted ? queue.toReversed() : []}
        axis="y"
        onReorder={handleReorder}
        as="tbody"
      >
        {isMounted && queue.toReversed().map((entry) => (
          <SongEntry
            key={`queue-${entry.id}`}
            entry={entry}
            playing={false}
            queue={true}
          />
        ))}
      </Reorder.Group>
    </Table>
  );
}
