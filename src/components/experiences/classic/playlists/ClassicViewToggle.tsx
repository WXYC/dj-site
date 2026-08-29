"use client";

import "@/src/styles/classic/schedule-week.css";

export default function ClassicViewToggle({
  isWeekView,
  onChange,
}: {
  isWeekView: boolean;
  onChange: (view: "search" | "week") => void;
}) {
  return (
    <div className="classic-schedule-week-toggle" role="group" aria-label="Previous sets view">
      <button
        type="button"
        aria-pressed={!isWeekView}
        onClick={() => onChange("search")}
      >
        Search
      </button>
      |
      <button
        type="button"
        aria-pressed={isWeekView}
        onClick={() => onChange("week")}
      >
        Week
      </button>
    </div>
  );
}
