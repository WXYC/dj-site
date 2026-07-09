"use client";

import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import SongEntry from "@/src/components/experiences/modern/flowsheet/Entries/SongEntry/SongEntry";
import { Table } from "@mui/joy";
import { Reorder } from "motion/react";
import { flowsheetSlice } from "@/lib/features/flowsheet/frontend";
import { useCallback, useEffect, useState } from "react";

export default function Queue() {
  const queue = useAppSelector((state) => state.flowsheet.queue);
  const dispatch = useAppDispatch();
  const [isMounted, setIsMounted] = useState(false);

  // Only render queue content after client-side mount to avoid hydration mismatch
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Handler for reordering queue items - Disabled for now
  const handleReorder = useCallback((newOrder: typeof queue) => {
    // Reordering disabled
  }, []);

  return (
    <Table
      borderAxis="none"
      variant="soft"
      sx={{
        // Match the entries table's soft rounded-row treatment.
        borderCollapse: "separate",
        borderSpacing: "0 4px",
        "--TableCell-paddingX": "12px",
        "& tbody tr": { transition: "filter 120ms" },
        "& tbody tr:hover": { filter: "brightness(1.08)" },
        "& tbody tr > td": { backgroundColor: "var(--row-bg, transparent)" },
        "& tbody tr > td:first-of-type": {
          borderTopLeftRadius: "8px",
          borderBottomLeftRadius: "8px",
        },
        "& tbody tr > td:last-of-type": {
          borderTopRightRadius: "8px",
          borderBottomRightRadius: "8px",
        },
        "@media (hover: hover)": {
          "& tbody tr .row-actions > :not(.row-actions-persist)": {
            opacity: 0,
            transition: "opacity 120ms",
          },
          "& tbody tr:hover .row-actions > *, & tbody tr:focus-within .row-actions > *":
            {
              opacity: 1,
            },
          "& tbody tr:hover .row-actions, & tbody tr:focus-within .row-actions":
            {
              background:
                "linear-gradient(to right, transparent, var(--row-bg) 18px)",
            },
        },
      }}
    >
      <thead
        style={{
          visibility: "collapse",
        }}
      >
        {/* Column sizing only — must match the entries table's 6-column grid. */}
        <tr>
          <td style={{ width: "60px" }}></td>
          <td></td>
          <td></td>
          <td></td>
          <td></td>
          <td style={{ width: "150px" }}></td>
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
