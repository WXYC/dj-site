"use client";

import { DateTimeEntry } from "@/lib/features/flowsheet/types";
import { Stack, Typography } from "@mui/joy";
import { useEffect, useState } from "react";

export default function DateTimeStack({ day, time }: DateTimeEntry) {
  const [isToday, setIsToday] = useState(false);
  useEffect(() => {
    const today = new Date();
    const entryDate = new Date(day);
    setIsToday(
      today.getFullYear() === entryDate.getFullYear() &&
        today.getMonth() === entryDate.getMonth() &&
        today.getDate() === entryDate.getDate()
    );
  }, [day]);

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
