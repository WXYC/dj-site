"use client";

import { useMemo } from "react";
import { Box, CircularProgress, Sheet, Table, Typography } from "@mui/joy";
import type { FlowsheetRangeEntry, FlowsheetRangeShow } from "@wxyc/shared";
import { convertRangeEntry } from "@/lib/features/flowsheet/conversions";
import { formatStationClockTime } from "@/src/utilities/stationTime";
import Entry from "@/src/components/experiences/modern/flowsheet/Entries/Entry";
import {
  FLOWSHEET_TABLE_SX,
  FlowsheetColumnSizingRow,
} from "@/src/components/experiences/modern/flowsheet/Entries/tableStyles";
import { SHOW_PANEL_ID } from "./ShowBlock";

const timeOf = (entry: FlowsheetRangeEntry) =>
  // A breakpoint is logged roughly a minute either side of the hour it marks,
  // so its own add_time reads the wrong hour. radio_hour is the hour it stands
  // for.
  formatStationClockTime(
    entry.entry_type === "breakpoint" && entry.radio_hour != null
      ? entry.radio_hour
      : entry.add_time
  );

export default function ShowEntriesPanel({
  show,
  entries,
  isPartial,
  partialEdge,
  isLoading,
}: {
  show: FlowsheetRangeShow;
  entries: FlowsheetRangeEntry[];
  isPartial: boolean;
  partialEdge: "before" | "after" | null;
  isLoading: boolean;
}) {
  // Rows are built once per entry list rather than per render: Entry is
  // memoized on its props, and a fresh object per render defeats that.
  const rows = useMemo(
    () =>
      entries.map((entry) => ({
        id: entry.id,
        timeLabel: timeOf(entry),
        converted: convertRangeEntry(entry),
      })),
    [entries]
  );

  return (
    <Sheet
      id={SHOW_PANEL_ID}
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
          {/* The live flowsheet's own rows, read-only. The rotation chip on an
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
            <tbody>
              {rows.map(({ id, timeLabel, converted }) => (
                <Entry
                  key={id}
                  entry={converted}
                  playing={false}
                  draggable={false}
                  readOnly
                  timeLabel={timeLabel}
                />
              ))}
            </tbody>
          </Table>
        </Box>
      )}
    </Sheet>
  );
}
