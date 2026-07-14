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
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export default function Queue() {
  const queue = useAppSelector((state) => state.flowsheet.queue);
  const dispatch = useAppDispatch();
  const [isMounted, setIsMounted] = useState(false);

  // Only render queue content after client-side mount to avoid hydration mismatch
  useEffect(() => {
    setIsMounted(true);
  }, []);

  const isMobile = useMediaQuery(FLOWSHEET_MOBILE_QUERY);

  // Order shown mid-drag (null when settled), mirrored in refs so the drag
  // context below never changes identity (see @entries/page.tsx).
  const [draftOrder, setDraftOrder] = useState<FlowsheetSongEntry[] | null>(
    null
  );
  const draftOrderRef = useRef<FlowsheetSongEntry[] | null>(null);

  // The queue renders newest-last, so display order is the reverse of the
  // stored order — and a dropped order must be un-reversed before storage.
  const reversed = useMemo(() => queue.toReversed(), [queue]);
  const reversedRef = useRef(reversed);
  reversedRef.current = reversed;

  const handleReorder = useCallback((next: FlowsheetSongEntry[]) => {
    draftOrderRef.current = next;
    setDraftOrder(next);
  }, []);

  const dragContext = useMemo<FlowsheetDragContextValue>(
    () => ({
      // Pure client state — nothing to freeze or suspend.
      onEntryDragStart: () => {},
      onEntryDragEnd: () => {
        dispatch(
          flowsheetSlice.actions.reorderQueue(
            (draftOrderRef.current ?? reversedRef.current).toReversed()
          )
        );
        draftOrderRef.current = null;
        setDraftOrder(null);
      },
    }),
    [dispatch]
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

  const visualOrder = draftOrder ?? reversed;

  return (
    <Table borderAxis="none" sx={FLOWSHEET_TABLE_SX}>
      <thead
        style={{
          visibility: "collapse",
        }}
      >
        <FlowsheetColumnSizingRow />
      </thead>
      <FlowsheetDragContext.Provider value={dragContext}>
        <Reorder.Group
          values={visualOrder}
          axis="y"
          onReorder={handleReorder}
          as="tbody"
        >
          {visualOrder.map((entry) => (
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
