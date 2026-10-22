"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { Reorder } from "motion/react";
import { Box, CircularProgress, Sheet, Table, Typography } from "@mui/joy";
import type { FlowsheetRangeShow } from "@wxyc/shared";
import type { FlowsheetRangeEntryWire } from "@/lib/features/flowsheet/conversions";
import { toArchiveStreamRow } from "@/lib/features/flowsheet/stream-row";
import { computeDragTarget } from "@/lib/features/flowsheet/reorder";
import type { FlowsheetEntry } from "@/lib/features/flowsheet/types";
import { useEntryActions } from "@/src/hooks/entryActions";
import {
  FlowsheetDragContext,
  FlowsheetDragContextValue,
} from "@/src/components/experiences/modern/flowsheet/Entries/dragContext";
import Entry from "@/src/components/experiences/modern/flowsheet/Entries/Entry";
import {
  FLOWSHEET_TABLE_SX,
  FlowsheetColumnSizingRow,
} from "@/src/components/experiences/modern/flowsheet/Entries/tableStyles";

export default function ShowEntriesPanel({
  show,
  entries,
  isPartial,
  partialEdge,
  isLoading,
  highlightedEntryId = null,
  editable = false,
}: {
  show: FlowsheetRangeShow;
  entries: FlowsheetRangeEntryWire[];
  isPartial: boolean;
  partialEdge: "before" | "after" | null;
  isLoading: boolean;
  /** The playcut an archive link named, or null when the show was opened plain. */
  highlightedEntryId?: number | null;
  /** The rows offer edit and remove; the caller supplies what those do. */
  editable?: boolean;
}) {
  // Rows are built once per entry list rather than per render: Entry is
  // memoized on its props, and a fresh object per render defeats that. The
  // highlighted id is deliberately not part of this key — it is compared at
  // the map site below, where a changed mark re-renders only the two rows
  // whose boolean flipped instead of reconverting every row in the set.
  const rows = useMemo(() => entries.map(toArchiveStreamRow), [entries]);

  // Order shown mid-drag, null when settled. The drag context reads it through
  // refs so its identity never changes: every row consumes it.
  const { reorder } = useEntryActions();
  const [draftOrder, setDraftOrder] = useState<FlowsheetEntry[] | null>(null);
  const draftRef = useRef<FlowsheetEntry[] | null>(null);
  const settledRef = useRef<FlowsheetEntry[]>([]);
  // Frozen when a drag starts, so a playlist refetch that lands mid-drag
  // cannot change the "before" order the drop target is computed against.
  // Held in state as well as a ref: the render draws it, so clearing it at drag
  // end must schedule a render even when no row moved and the draft is unchanged.
  const [snapshot, setSnapshot] = useState<FlowsheetEntry[] | null>(null);
  const snapshotRef = useRef<FlowsheetEntry[] | null>(null);
  settledRef.current = rows.map((row) => row.entry);
  const reorderRef = useRef(reorder);
  reorderRef.current = reorder;

  const handleReorder = useCallback((next: FlowsheetEntry[]) => {
    draftRef.current = next;
    setDraftOrder(next);
  }, []);

  const dragContext = useMemo<FlowsheetDragContextValue>(
    () => ({
      onEntryDragStart: () => {
        snapshotRef.current = settledRef.current;
        setSnapshot(settledRef.current);
      },
      onEntryDragEnd: (entry) => {
        const snapshot = snapshotRef.current ?? settledRef.current;
        const newPosition = computeDragTarget(
          snapshot,
          draftRef.current ?? snapshot,
          entry.id
        );
        if (newPosition !== null) {
          reorderRef.current(entry, newPosition);
        }
        snapshotRef.current = null;
        setSnapshot(null);
        draftRef.current = null;
        setDraftOrder(null);
      },
    }),
    []
  );

  const entryById = new Map(rows.map((row) => [row.id, row]));
  const shown = draftOrder ?? snapshot ?? settledRef.current;

  return (
    <Sheet
      variant="outlined"
      sx={{ mt: 2, borderRadius: "md", p: 2 }}
    >
      <Typography level="title-md" component="h3">
        {show.show_name ?? show.dj_name ?? "Unattributed show"}
      </Typography>

      {isLoading && (
        <Box sx={{ display: "flex", justifyContent: "center", py: 2 }}>
          <CircularProgress size="sm" />
        </Box>
      )}

      {isPartial && (
        <Typography level="body-sm" color="warning" sx={{ mt: 1 }}>
          Showing the {entries.length} entries logged during this week. This
          show{" "}
          {partialEdge === "after"
            ? "ran past the end of the week, and the rest are in the next week."
            : "began before the week started, and the rest are in the previous week."}
        </Typography>
      )}

      {!isLoading && entries.length === 0 && (
        <Typography level="body-sm" sx={{ mt: 1, color: "text.secondary" }}>
          No entries recorded for this show.
        </Typography>
      )}

      {/* No inner scrollport: the view above already scrolls, and a capped
          panel inside it puts a second bar beside the first for the same
          gesture. */}
      {rows.length > 0 && (
        <Box sx={{ mt: 1 }}>
          {/* The live flowsheet's own rows; read-only unless `editable`. The rotation chip on an
              archived play means the release was in rotation at some point --
              the read-path window is not evaluated against the air date -- so
              nothing here may claim it names the bin the play aired under. */}
          <Table
            borderAxis="none"
            sx={FLOWSHEET_TABLE_SX}
            aria-label="show entries"
          >
            <thead style={{ visibility: "collapse" }}>
              <FlowsheetColumnSizingRow leadingTimeColumn />
            </thead>
            <FlowsheetDragContext.Provider value={dragContext}>
              <Reorder.Group
                values={shown}
                axis="y"
                onReorder={handleReorder}
                as="tbody"
              >
                {shown.map((entry) => (
                  <Entry
                    key={entry.id}
                    entry={entry}
                    playing={false}
                    draggable
                    readOnly={!editable}
                    timeLabel={entryById.get(entry.id)?.timeLabel}
                    highlighted={entry.id === highlightedEntryId}
                  />
                ))}
              </Reorder.Group>
            </FlowsheetDragContext.Provider>
          </Table>
        </Box>
      )}
    </Sheet>
  );
}
