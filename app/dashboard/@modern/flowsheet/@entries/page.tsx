"use client";

import { flowsheetSlice } from "@/lib/features/flowsheet/frontend";
import {
  computeDragTarget,
  moveAdjacent,
} from "@/lib/features/flowsheet/reorder";
import {
  FlowsheetEntry,
  isFlowsheetEndShowEntry,
  isFlowsheetStartShowEntry,
} from "@/lib/features/flowsheet/types";
import { useAppDispatch } from "@/lib/hooks";
import {
  FlowsheetDragContext,
  FlowsheetDragContextValue,
  FlowsheetMoveContext,
  FlowsheetMoveContextValue,
} from "@/src/components/experiences/modern/flowsheet/Entries/dragContext";
import Entry from "@/src/components/experiences/modern/flowsheet/Entries/Entry";
import MobileEntry from "@/src/components/experiences/modern/flowsheet/Entries/MobileEntry";
import {
  FLOWSHEET_MOBILE_QUERY,
  FLOWSHEET_TABLE_SX,
  FlowsheetColumnSizingRow,
} from "@/src/components/experiences/modern/flowsheet/Entries/tableStyles";
import FlowsheetSkeletonLoader from "@/src/components/experiences/modern/flowsheet/FlowsheetSkeletonLoader";
import { useFlowsheet } from "@/src/hooks/flowsheetHooks";
import { useMediaQuery } from "@/src/hooks/useMediaQuery";
import { Box, Table } from "@mui/joy";
import { Reorder } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// Show start/end markers bound the reorderable region: they're never
// draggable, and no entry may be moved across one (a song ordered before the
// show started / after it ended is nonsense). Desktop drag enforces this for
// free — markers render outside the Reorder tree, so motion never swaps them
// — but the mobile up/down path walks the raw array and must exclude them.
const isMarkerEntry = (entry: FlowsheetEntry) =>
  isFlowsheetStartShowEntry(entry) || isFlowsheetEndShowEntry(entry);

export default function FlowsheetEntries() {
  const dispatch = useAppDispatch();
  const {
    loading,
    entries: { current, previous, switchEntries },
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

  const isMobile = useMediaQuery(FLOWSHEET_MOBILE_QUERY);

  // Order shown mid-drag (null when settled), mirrored in refs alongside the
  // other live values so the drag context below never changes identity —
  // every row consumes it, and a per-crossover identity change would re-render
  // them all through their memo.
  const [draftOrder, setDraftOrder] = useState<FlowsheetEntry[] | null>(null);
  const draftOrderRef = useRef<FlowsheetEntry[] | null>(null);
  const snapshotRef = useRef<FlowsheetEntry[] | null>(null);
  const currentRef = useRef(current);
  currentRef.current = current;
  const switchEntriesRef = useRef(switchEntries);
  switchEntriesRef.current = switchEntries;

  const handleReorder = useCallback((next: FlowsheetEntry[]) => {
    draftOrderRef.current = next;
    setDraftOrder(next);
  }, []);

  const dragContext = useMemo<FlowsheetDragContextValue>(
    () => ({
      // The frozen snapshot anchors the drag-end position math and keeps
      // SSE-forced refetches from reshuffling rows mid-drag (polling is
      // separately suspended via isDragging).
      onEntryDragStart: () => {
        snapshotRef.current = currentRef.current;
        dispatch(flowsheetSlice.actions.setIsDragging(true));
      },
      // Fire-and-forget: the optimistic cache move settles the rows the
      // moment the drag ends; a failed request reverts and resyncs.
      onEntryDragEnd: (entry) => {
        const snapshot = snapshotRef.current ?? currentRef.current;
        const newPosition = computeDragTarget(
          snapshot,
          draftOrderRef.current ?? snapshot,
          entry.id
        );
        if (newPosition !== null) {
          switchEntriesRef.current(entry, newPosition);
        }
        snapshotRef.current = null;
        draftOrderRef.current = null;
        setDraftOrder(null);
        dispatch(flowsheetSlice.actions.setIsDragging(false));
      },
    }),
    [dispatch]
  );

  // Mobile reorders one step at a time (up/down buttons instead of drag):
  // a one-step move is just a drag whose final order is the adjacent swap.
  const moveContext = useMemo<FlowsheetMoveContextValue>(
    () => ({
      moveEntry: (entry, direction) => {
        const current = currentRef.current;
        const index = current.findIndex((e) => e.id === entry.id);
        if (index === -1) return;
        // Never swap an entry past a show marker (see isMarkerEntry). The
        // buttons are already disabled at that edge, but the guard keeps the
        // invariant in the data path too.
        const neighbor = current[direction === "up" ? index - 1 : index + 1];
        if (!neighbor || isMarkerEntry(neighbor)) return;
        const next = moveAdjacent(current, entry.id, direction);
        if (!next) return;
        const newPosition = computeDragTarget(current, next, entry.id);
        if (newPosition !== null) {
          switchEntriesRef.current(entry, newPosition);
        }
      },
    }),
    []
  );

  if (!mounted || loading) {
    return <FlowsheetSkeletonLoader count={10} />;
  }

  // Reorder bounds are the first/last draggable row, not the array edges:
  // a show marker sits at the bottom while live, and the oldest song must
  // stop above it rather than swap past it.
  const firstDraggable = current.findIndex((e) => !isMarkerEntry(e));
  const lastDraggable = current.findLastIndex((e) => !isMarkerEntry(e));

  if (isMobile) {
    return (
      <FlowsheetMoveContext.Provider value={moveContext}>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
          {current.map((entry, index) => (
            <MobileEntry
              key={entry.id}
              entry={entry}
              playing={index == 0}
              canMoveUp={index > firstDraggable}
              canMoveDown={index < lastDraggable}
            />
          ))}
          {previous.map((entry, index) => (
            <MobileEntry
              key={entry.id}
              entry={entry}
              playing={index == 0 && current.length == 0}
            />
          ))}
        </Box>
      </FlowsheetMoveContext.Provider>
    );
  }

  const visualOrder = draftOrder ?? snapshotRef.current ?? current;

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
            <Entry
              key={entry.id}
              entry={entry}
              // Pinned to the settled order so the now-playing styling
              // doesn't hop between rows mid-drag.
              playing={entry.id === current[0]?.id}
              draggable
            />
          ))}
        </Reorder.Group>
      </FlowsheetDragContext.Provider>
      {/* Previous shows are never reorderable, so they render as plain rows
          in a second tbody — outside the motion tree. A mounted Reorder.Item
          missing from the group's `values` wedges motion's reorder detection
          when a drag crosses it. */}
      <tbody>
        {previous.map((entry, index) => (
          <Entry
            key={entry.id}
            entry={entry}
            playing={index == 0 && current.length == 0}
            draggable={false}
          />
        ))}
      </tbody>
    </Table>
  );
}
