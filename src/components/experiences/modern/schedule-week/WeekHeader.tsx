"use client";

import { ChevronLeft, ChevronRight } from "@mui/icons-material";
import { Box, Button, Typography } from "@mui/joy";
import {
  addStationWeeks,
  STATION_TIME_ZONE,
  stationDaysOfWeek,
} from "@/src/utilities/stationTime";

const range = (weekStart: Date) => {
  const days = stationDaysOfWeek(weekStart);
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: STATION_TIME_ZONE,
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  return `${fmt.format(days[0])} – ${fmt.format(days[6])}`;
};

export default function WeekHeader({
  weekStart,
  hasNextWeek,
  onChangeWeek,
}: {
  weekStart: Date;
  hasNextWeek: boolean;
  onChangeWeek: (next: Date) => void;
}) {
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 1,
        py: 1,
      }}
    >
      <Button
        variant="outlined"
        size="sm"
        startDecorator={<ChevronLeft />}
        onClick={() => onChangeWeek(addStationWeeks(weekStart, -1))}
      >
        Previous week
      </Button>

      <Typography level="title-md" component="h3">
        {range(weekStart)}
      </Typography>

      <Button
        variant="outlined"
        size="sm"
        endDecorator={<ChevronRight />}
        disabled={!hasNextWeek}
        onClick={() => onChangeWeek(addStationWeeks(weekStart, 1))}
      >
        Next week
      </Button>
    </Box>
  );
}
