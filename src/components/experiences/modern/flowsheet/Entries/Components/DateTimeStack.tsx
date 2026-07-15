"use client";

import { DateTimeEntry } from "@/lib/features/flowsheet/types";
import { Stack, Typography } from "@mui/joy";

// `isToday` is computed upstream in formatAddTime/parseTimestamp where the real
// Date is in scope. This component must NOT re-derive it via `new Date(day)`:
// `day` is a "M/D/YYYY" display string, and non-ISO Date parsing is Safari-
// dependent (Invalid Date), which false-negatived the old check. (dj-site#622)
export default function DateTimeStack({ day, time, isToday }: DateTimeEntry) {
  return (
    <Stack direction="column">
      <Typography
        level="body-xs"
        textColor="text.tertiary"
        sx={{ alignSelf: "flex-end" }}
      >
        {time}
      </Typography>
      {!isToday && (
        <Typography
          level="body-xxs"
          textColor="text.icon"
          sx={{ alignSelf: "flex-end" }}
        >
          {day}
        </Typography>
      )}
    </Stack>
  );
}
