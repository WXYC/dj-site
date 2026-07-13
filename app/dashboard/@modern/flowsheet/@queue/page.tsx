"use client";

import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import SongEntry from "@/src/components/experiences/modern/flowsheet/Entries/SongEntry/SongEntry";
import MobileSongEntry from "@/src/components/experiences/modern/flowsheet/Entries/SongEntry/MobileSongEntry";
import {
  FLOWSHEET_MOBILE_QUERY,
  FLOWSHEET_TABLE_SX,
  FlowsheetColumnSizingRow,
} from "@/src/components/experiences/modern/flowsheet/Entries/tableStyles";
import { useMediaQuery } from "@/src/hooks/useMediaQuery";
import { Box, Table } from "@mui/joy";
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

  const isMobile = useMediaQuery(FLOWSHEET_MOBILE_QUERY);

  // Handler for reordering queue items - Disabled for now
  const handleReorder = useCallback((newOrder: typeof queue) => {
    // Reordering disabled
  }, []);

  // An empty queue renders nothing — the bare table shell reads as a
  // stray grey bar above the entries.
  if (!isMounted || queue.length === 0) {
    return null;
  }

  const reversed = queue.toReversed();

  if (isMobile) {
    return (
      <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
        {reversed.map((entry) => (
          <MobileSongEntry
            key={`queue-mobile-${entry.id}`}
            entry={entry}
            playing={false}
            queue={true}
          />
        ))}
      </Box>
    );
  }

  return (
    <Table borderAxis="none" sx={FLOWSHEET_TABLE_SX}>
      <thead
        style={{
          visibility: "collapse",
        }}
      >
        <FlowsheetColumnSizingRow />
      </thead>
      <Reorder.Group
        values={reversed}
        axis="y"
        onReorder={handleReorder}
        as="tbody"
      >
        {reversed.map((entry) => (
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
