"use client";

import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import SongEntry from "@/src/components/experiences/modern/flowsheet/Entries/SongEntry/SongEntry";
import MobileSongEntry from "@/src/components/experiences/modern/flowsheet/Entries/SongEntry/MobileSongEntry";
import {
  FLOWSHEET_MOBILE_QUERY,
  FLOWSHEET_TABLE_SX,
  FlowsheetColumnSizingRow,
} from "@/src/components/experiences/modern/flowsheet/Entries/tableStyles";
import {
  FlowsheetDragContext,
  FlowsheetDragContextValue,
} from "@/src/components/experiences/modern/flowsheet/Entries/dragContext";
import { useMediaQuery } from "@/src/hooks/useMediaQuery";
import { Box, Table } from "@mui/joy";
import { Reorder } from "motion/react";
import { flowsheetSlice } from "@/lib/features/flowsheet/frontend";
import { FlowsheetSongEntry } from "@/lib/features/flowsheet/types";
import { useEffect, useMemo, useState } from "react";

export default function Queue() {
  const queue = useAppSelector((state) => state.flowsheet.queue);
  const dispatch = useAppDispatch();
  const [isMounted, setIsMounted] = useState(false);

  // Only render queue content after client-side mount to avoid hydration mismatch
  useEffect(() => {
    setIsMounted(true);
  }, []);

  const isMobile = useMediaQuery(FLOWSHEET_MOBILE_QUERY);

  // Visual order while a drag is in flight; committed to the slice (and
  // localStorage) once on drop rather than on every crossover.
  const [order, setOrder] = useState<FlowsheetSongEntry[] | null>(null);

  const reversed = useMemo(() => queue.toReversed(), [queue]);
  const visualQueue = order ?? reversed;

  const dragContextValue = useMemo<FlowsheetDragContextValue>(
    () => ({
      // Queue order is pure client state — no poll/refetch can yank it, so
      // there's nothing to freeze or suspend on drag start.
      onEntryDragStart: () => {},
      onEntryDragEnd: () => {
        // The queue renders newest-last (reversed), so un-reverse the visual
        // order before it becomes the stored queue.
        dispatch(
          flowsheetSlice.actions.reorderQueue(
            (order ?? reversed).toReversed()
          )
        );
        setOrder(null);
      },
    }),
    [order, reversed, dispatch]
  );

  // An empty queue renders nothing — the bare table shell reads as a
  // stray grey bar above the entries.
  if (!isMounted || queue.length === 0) {
    return null;
  }

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
      <FlowsheetDragContext.Provider value={dragContextValue}>
        <Reorder.Group
          values={visualQueue}
          axis="y"
          onReorder={setOrder}
          as="tbody"
        >
          {visualQueue.map((entry) => (
            <SongEntry
              key={`queue-${entry.id}`}
              entry={entry}
              playing={false}
              queue={true}
            />
          ))}
        </Reorder.Group>
      </FlowsheetDragContext.Provider>
    </Table>
  );
}
