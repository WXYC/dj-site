"use client";

import { flowsheetSlice } from "@/lib/features/flowsheet/frontend";
import { useAppDispatch } from "@/lib/hooks";
import {
  FlowsheetDragContext,
  FlowsheetMoveContext,
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
import { useReorderableEntries } from "@/src/hooks/useReorderableEntries";
import { Box, Table } from "@mui/joy";
import { Reorder } from "motion/react";
import { useCallback, useEffect, useState } from "react";

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

  // Fire-and-forget: the optimistic cache move settles the rows the moment the
  // drag ends; a failed request reverts and resyncs. Polling is suspended
  // while dragging so SSE-forced refetches don't reshuffle rows mid-drag.
  const onDraggingChange = useCallback(
    (dragging: boolean) => {
      dispatch(flowsheetSlice.actions.setIsDragging(dragging));
    },
    [dispatch]
  );
  const {
    shown: visualOrder,
    onReorder,
    dragContext,
    moveContext,
    firstDraggable,
    lastDraggable,
  } = useReorderableEntries({
    entries: current,
    reorder: switchEntries,
    onDraggingChange,
  });

  if (!mounted || loading) {
    return <FlowsheetSkeletonLoader count={10} />;
  }

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
          onReorder={onReorder}
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
