"use client";

import type { FlowsheetRangeEntry, FlowsheetRangeShow } from "@wxyc/shared";
import { formatStationClockTime } from "@/src/utilities/stationTime";
import { describeNonTrackEntry } from "@/lib/features/schedule-week/entryLabel";
import { CLASSIC_SHOW_PANEL_ID } from "./ClassicWeekGrid";
import "@/src/styles/classic/schedule-week.css";

const timeOf = (entry: FlowsheetRangeEntry) =>
  // A breakpoint is logged roughly a minute either side of the hour it marks,
  // so its add_time reads the wrong hour. radio_hour is the hour it stands for.
  formatStationClockTime(
    entry.entry_type === "breakpoint" && entry.radio_hour != null
      ? entry.radio_hour
      : entry.add_time
  );

export default function ClassicShowEntries({
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
  return (
    <div id={CLASSIC_SHOW_PANEL_ID} className="classic-schedule-week-entries">
      <h3 className="bigblue">
        {show.show_name ?? show.dj_name ?? "Unattributed show"}
      </h3>

      {isLoading && <p className="text">Loading…</p>}

      {isPartial && (
        <p className="redlabel">
          Showing the {entries.length} entries logged during this week. This
          show{" "}
          {partialEdge === "after"
            ? "ran past the end of the week, and the rest are in the next week."
            : "began before the week started, and the rest are in the previous week."}
        </p>
      )}

      {!isLoading && entries.length === 0 && (
        <p className="text">No entries recorded for this show.</p>
      )}

      {entries.length > 0 && (
        <table>
          <thead>
            <tr>
              <th style={{ width: "5em" }}>Time</th>
              <th>Artist</th>
              <th>Song</th>
              <th>Release</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.id}>
                <td>{timeOf(entry)}</td>
                {entry.entry_type && entry.entry_type !== "track" ? (
                  <td colSpan={3}>
                    <em>{describeNonTrackEntry(entry)}</em>
                  </td>
                ) : (
                  <>
                    <td>{entry.artist_name}</td>
                    <td>{entry.track_title}</td>
                    <td>{entry.album_title}</td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
