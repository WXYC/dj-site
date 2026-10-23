"use client";

import { useMemo } from "react";
import { Reorder } from "motion/react";
import { Box, CircularProgress, Sheet, Table, Typography } from "@mui/joy";
import type { FlowsheetRangeShow } from "@wxyc/shared";
import type { FlowsheetRangeEntryWire } from "@/lib/features/flowsheet/conversions";
import { entryAnchorId } from "@/lib/features/schedule-week/showUrl";
import { toArchiveStreamRow } from "@/lib/features/flowsheet/stream-row";
import { useEntryActions } from "@/src/hooks/entryActions";
import { useMediaQuery } from "@/src/hooks/useMediaQuery";
import { useReorderableEntries } from "@/src/hooks/useReorderableEntries";
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

  const { reorder } = useEntryActions();
  const settled = useMemo(() => rows.map((row) => row.entry), [rows]);
  const isMobile = useMediaQuery(FLOWSHEET_MOBILE_QUERY);
  const {
    shown,
    onReorder,
    dragContext,
    moveContext,
    firstDraggable,
    lastDraggable,
  } = useReorderableEntries({
    entries: settled,
    reorder,
  });

  const entryById = new Map(rows.map((row) => [row.id, row]));

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
      {rows.length > 0 && isMobile && (
        <FlowsheetMoveContext.Provider value={moveContext}>
          <Box sx={{ mt: 1, display: "flex", flexDirection: "column", gap: 1.5 }}>
            {settled.map((entry, index) => {
              const highlighted = entry.id === highlightedEntryId;
              // The table rows carry the anchor id and the highlight mark on
              // the row itself; a card has no row, so the wrapper carries the
              // same ones. As on the table, only the named play gets the id,
              // so two sets in one document never collide.
              return (
                <Box
                  key={entry.id}
                  id={highlighted ? entryAnchorId(entry.id) : undefined}
                  data-testid={`flowsheet-entry-${entry.id}`}
                  className={highlighted ? "row-highlighted" : undefined}
                  sx={{
                    borderRadius: "xl",
                    "&.row-highlighted": {
                      outline: "2px solid",
                      outlineColor: "var(--joy-palette-danger-solidBg)",
                      outlineOffset: "2px",
                    },
                  }}
                >
                  <MobileEntry
                    entry={entry}
                    playing={false}
                    readOnly={!editable}
                    canMoveUp={index > firstDraggable}
                    canMoveDown={index < lastDraggable}
                  />
                </Box>
              );
            })}
          </Box>
        </FlowsheetMoveContext.Provider>
      )}

      {rows.length > 0 && !isMobile && (
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
                onReorder={onReorder}
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
