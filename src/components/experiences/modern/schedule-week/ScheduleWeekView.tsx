"use client";

import { Box, CircularProgress, Typography } from "@mui/joy";
import {
  useScheduleWeek,
  useScheduleWeekParams,
} from "@/src/hooks/scheduleWeekHooks";
import WeekGrid from "./WeekGrid";
import WeekHeader from "./WeekHeader";

export default function ScheduleWeekView() {
  const { weekStart, setWeek, hrefForShow } = useScheduleWeekParams();
  const { grid, isLoading, isError, hasNextWeek } = useScheduleWeek(weekStart);

  return (
    // `Main` is `height: 100dvh; overflow: hidden`, so a page that does not
    // carry its own scrollport simply loses the bottom of a 24-hour grid.
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
      <WeekGrid columns={grid.columns} hrefForShow={hrefForShow} />

      {grid.unattributedEntryCount > 0 && (
        <Typography level="body-xs" sx={{ mt: 1, color: "text.tertiary" }}>
          {grid.unattributedEntryCount} entr
          {grid.unattributedEntryCount === 1 ? "y" : "ies"} this week are not
          linked to a show and cannot be placed on the grid.
        </Typography>
      )}

    </Box>
  );
}
