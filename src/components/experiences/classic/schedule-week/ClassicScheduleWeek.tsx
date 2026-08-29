"use client";

import { useMemo } from "react";
import {
  useScheduleWeek,
  useScheduleWeekParams,
  useShowEntries,
} from "@/src/hooks/scheduleWeekHooks";
import {
  addStationWeeks,
  STATION_TIME_ZONE,
  stationDaysOfWeek,
} from "@/src/utilities/stationTime";
import ClassicWeekGrid from "./ClassicWeekGrid";
import ClassicShowEntries from "./ClassicShowEntries";
import "@/src/styles/classic/schedule-week.css";

// Reproduces the source JSP's "MM/DD/YYYY - MM/DD/YYYY" week caption.
const range = (weekStart: Date) => {
  const days = stationDaysOfWeek(weekStart);
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: STATION_TIME_ZONE,
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
  });
  return `${fmt.format(days[0])} - ${fmt.format(days[6])}`;
};

export default function ClassicScheduleWeek() {
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
    <div className="classic-schedule-week">
      <div className="radioWeekHeader">
        <button
          type="button"
          className="linklike"
          onClick={() => setWeek(addStationWeeks(weekStart, -1))}
        >
          &lt;&lt;Previous Week
        </button>
        <span>{range(weekStart)}</span>
        <button
          type="button"
          className="linklike"
          disabled={!hasNextWeek}
          onClick={() => setWeek(addStationWeeks(weekStart, 1))}
        >
          Next Week&gt;&gt;
        </button>
      </div>

      {isError && (
        <p className="redlabel" style={{ textAlign: "center" }}>
          This week could not be loaded. Try again, or pick another week.
        </p>
      )}

      {isLoading && <p className="text" style={{ textAlign: "center" }}>Loading…</p>}

      {/* An empty window is a normal answer, not an error: the grid renders as
          seven days of dead air rather than an error state. */}
      <ClassicWeekGrid
        columns={grid.columns}
        selectedShowId={selectedShowId}
        onSelectShow={toggleShow}
      />

      {grid.unattributedEntryCount > 0 && (
        <p className="smalltext">
          {grid.unattributedEntryCount} entr
          {grid.unattributedEntryCount === 1 ? "y" : "ies"} this week are not
          linked to a show and cannot be placed on the grid.
        </p>
      )}

      {selectedShow && (
        <ClassicShowEntries
          show={selectedShow}
          entries={showEntries.entries}
          isPartial={showEntries.isPartial}
          isLoading={showEntries.isLoading}
        />
      )}
    </div>
  );
}
