"use client";

import { CalendarViewWeek, Troubleshoot } from "@mui/icons-material";
import { Button, ButtonGroup } from "@mui/joy";

export default function ViewToggle({
  isWeekView,
  onChange,
}: {
  isWeekView: boolean;
  onChange: (view: "search" | "week") => void;
}) {
  return (
    <ButtonGroup size="sm" variant="outlined" aria-label="Previous sets view">
      <Button
        startDecorator={<Troubleshoot />}
        variant={isWeekView ? "outlined" : "solid"}
        color="primary"
        aria-pressed={!isWeekView}
        onClick={() => onChange("search")}
      >
        Search
      </Button>
      <Button
        startDecorator={<CalendarViewWeek />}
        variant={isWeekView ? "solid" : "outlined"}
        color="primary"
        aria-pressed={isWeekView}
        onClick={() => onChange("week")}
      >
        Week
      </Button>
    </ButtonGroup>
  );
}
