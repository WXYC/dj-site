"use client";

import { flowsheetSlice } from "@/lib/features/flowsheet/frontend";
import { computeDragTarget } from "@/lib/features/flowsheet/reorder";
import { FlowsheetEntry } from "@/lib/features/flowsheet/types";
import { useAppDispatch } from "@/lib/hooks";
import {
  FlowsheetDragContext,
  FlowsheetDragContextValue,
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
import { useEffect, useMemo, useRef, useState } from "react";

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

  // Visual order while a drag is in flight. `order` tracks Reorder.Group's
  // continuous onReorder updates; the snapshot freezes the pre-drag order so
  // (a) drag-end position math compares against what the DJ saw when they
  // grabbed the row, and (b) an SSE-invalidated refetch landing mid-drag
  // (invalidateTags bypasses the suspended pollingInterval) can't yank the
  // rows out from under the pointer. Both clear on drag end; from then on
  // the optimistically-patched `current` (play_order-sorted) matches the
  // dropped order, so the handoff is seamless.
  const [order, setOrder] = useState<FlowsheetEntry[] | null>(null);
  const frozenSnapshotRef = useRef<FlowsheetEntry[] | null>(null);

  const visualCurrent = order ?? frozenSnapshotRef.current ?? current;

  const dragContextValue = useMemo<FlowsheetDragContextValue>(
    () => ({
      onEntryDragStart: () => {
        frozenSnapshotRef.current = current;
        dispatch(flowsheetSlice.actions.setIsDragging(true));
      },
      onEntryDragEnd: (entry) => {
        const snapshot = frozenSnapshotRef.current ?? current;
        const newPosition = computeDragTarget(
          snapshot,
          order ?? snapshot,
          entry.id
        );
        if (newPosition !== null) {
          switchEntries(entry, newPosition);
        }
        frozenSnapshotRef.current = null;
        setOrder(null);
        dispatch(flowsheetSlice.actions.setIsDragging(false));
      },
    }),
    [order, current, switchEntries, dispatch]
  );

  if (!mounted || loading) {
    return <FlowsheetSkeletonLoader count={10} />;
  }

  if (isMobile) {
    return (
      <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
        {current.map((entry, index) => (
          <MobileEntry key={entry.id} entry={entry} playing={index == 0} />
        ))}
        {previous.map((entry, index) => (
          <MobileEntry
            key={entry.id}
            entry={entry}
            playing={index == 0 && current.length == 0}
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
          values={visualCurrent}
          axis="y"
          onReorder={setOrder}
          as="tbody"
        >
          {visualCurrent.map((entry) => (
            <Entry
              key={entry.id}
              entry={entry}
              // Pinned to the top entry of the settled order (not the row's
              // index in the mid-drag visual order) so the now-playing
              // styling doesn't hop between rows while dragging.
              playing={entry.id === current[0]?.id}
              draggable
            />
          ))}
        </Reorder.Group>
      </FlowsheetDragContext.Provider>
      {/* Previous shows are never reorderable, so they live in a second
          plain tbody: no Reorder.Item registration (a mounted Item missing
          from `values` wedges motion's reorder detection when a drag crosses
          it) and no motion layout tracking on the long history list. */}
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
