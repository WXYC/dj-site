"use client";

import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import SongEntry from "@/src/components/modern/flowsheet/Entries/SongEntry/SongEntry";
import { Table, useColorScheme } from "@mui/joy";
import { Reorder } from "motion/react";
import { flowsheetSlice } from "@/lib/features/flowsheet/frontend";
import { useCallback } from "react";

export default function Queue() {
  const { mode } = useColorScheme();
  const queue = useAppSelector((state) => state.flowsheet.queue);
  const dispatch = useAppDispatch();

  // Handler for reordering queue items - Disabled for now
  const handleReorder = useCallback((newOrder: typeof queue) => {
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
        values={queue.toReversed()}
        axis="y"
        onReorder={handleReorder}
        as="tbody"
      >
        {queue.toReversed().map((entry) => (
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
