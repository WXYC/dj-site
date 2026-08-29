"use client";

import { Box, Typography } from "@mui/joy";
import type { DayColumn } from "@/lib/features/schedule-week/layout";
import { STATION_TIME_ZONE } from "@/src/utilities/stationTime";
import ShowBlock from "./ShowBlock";

const HOUR_LABELS = [0, 3, 6, 9, 12, 15, 18, 21];

const dayHeading = (dayStartMs: number) =>
  new Intl.DateTimeFormat("en-US", {
    timeZone: STATION_TIME_ZONE,
    weekday: "short",
    month: "numeric",
    day: "numeric",
  }).format(new Date(dayStartMs));

const hourLabel = (hour: number) =>
  hour === 0 ? "12a" : hour === 12 ? "12p" : hour < 12 ? `${hour}a` : `${hour - 12}p`;

export default function WeekGrid({
  columns,
  selectedShowId,
  onSelectShow,
}: {
  columns: DayColumn[];
  selectedShowId: number | null;
  onSelectShow: (showId: number) => void;
}) {
  return (
    // Day columns become illegible before a phone viewport is reached, so the
    // grid scrolls inside itself rather than letting the page scroll sideways.
    <Box sx={{ overflowX: "auto", width: "100%" }}>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "3rem repeat(7, minmax(6.5rem, 1fr))",
          gap: 0.5,
          minWidth: "48rem",
        }}
      >
        <Box />
        {columns.map((column) => (
          <Typography
            key={column.dayStartMs}
            level="body-sm"
            sx={{ textAlign: "center", fontWeight: "md", pb: 0.5 }}
          >
            {dayHeading(column.dayStartMs)}
          </Typography>
        ))}

        <Box sx={{ position: "relative", height: "40rem" }}>
          {HOUR_LABELS.map((hour) => (
            <Typography
              key={hour}
              level="body-xs"
              sx={{
                position: "absolute",
                top: `${(hour / 24) * 100}%`,
                right: 4,
                color: "text.tertiary",
              }}
            >
              {hourLabel(hour)}
            </Typography>
          ))}
        </Box>

        {columns.map((column) => (
          <Box
            key={column.dayStartMs}
            sx={{
              position: "relative",
              height: "40rem",
              bgcolor: "background.level1",
              borderRadius: "4px",
            }}
          >
            {column.gaps.map((gap) => (
              <Box
                key={`${column.dayStartMs}-gap-${gap.topFraction}`}
                aria-hidden
                sx={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  top: `${gap.topFraction * 100}%`,
                  height: `${gap.heightFraction * 100}%`,
                  bgcolor: "neutral.softDisabledBg",
                  opacity: 0.5,
                }}
              />
            ))}
            {column.blocks.map((block) => (
              <ShowBlock
                key={`${column.dayStartMs}-${block.showId}`}
                block={block}
                isSelected={block.showId === selectedShowId}
                onSelect={onSelectShow}
              />
            ))}
          </Box>
        ))}
      </Box>
    </Box>
  );
}
