"use client";

import { useMemo } from "react";
import { Box, CircularProgress, Typography } from "@mui/joy";
import {
  useScheduleWeek,
  useScheduleWeekParams,
  useShowEntries,
} from "@/src/hooks/scheduleWeekHooks";
import WeekGrid from "./WeekGrid";
import WeekHeader from "./WeekHeader";
import ShowEntriesPanel from "./ShowEntriesPanel";

export default function ScheduleWeekView() {
  const { weekStart, selectedShowId, setWeek, toggleShow } =
    useScheduleWeekParams();
  const { grid, shows, entries, window, isLoading, isError, hasNextWeek, now } =
    useScheduleWeek(weekStart);

  const selectedShow = useMemo(
    () => shows.find((s) => s.id === selectedShowId) ?? null,
    [shows, selectedShowId],
  );

  const showEntries = useShowEntries(selectedShow, entries, window, now);

  return (
    // `Main` is `height: 100dvh; overflow: hidden`, so a page that does not
    // carry its own scrollport simply loses everything below the fold -- here
    // the bottom of a 24-hour grid, and the entry panel under it.
    <Box
      sx={{
        width: "100%",
        flex: 1,
        minHeight: 0,
        overflowY: "auto",
      }}
    >
      <WeekHeader
        weekStart={weekStart}
        hasNextWeek={hasNextWeek}
        onChangeWeek={setWeek}
      />

      {isError && (
        <Typography level="body-sm" color="danger" sx={{ py: 1 }}>
          This week could not be loaded. Try again, or pick another week.
        </Typography>
      )}

      {isLoading && (
        <Box sx={{ display: "flex", justifyContent: "center", py: 2 }}>
          <CircularProgress size="sm" />
        </Box>
      )}

      {/* An empty window is a normal answer, not an error: the grid renders as
          seven days of dead air rather than an error state. */}
      <WeekGrid
        columns={grid.columns}
        selectedShowId={selectedShowId}
        onSelectShow={toggleShow}
      />

      {grid.unattributedEntryCount > 0 && (
        <Typography level="body-xs" sx={{ mt: 1, color: "text.tertiary" }}>
          {grid.unattributedEntryCount} entr
          {grid.unattributedEntryCount === 1 ? "y" : "ies"} this week are not
          linked to a show and cannot be placed on the grid.
        </Typography>
      )}

      {selectedShow && (
        <ShowEntriesPanel
          show={selectedShow}
          entries={showEntries.entries}
          isPartial={showEntries.isPartial}
          isLoading={showEntries.isLoading}
        />
      )}
    </Box>
  );
}
