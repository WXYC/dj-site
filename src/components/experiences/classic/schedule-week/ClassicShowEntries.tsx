"use client";

import type { FlowsheetRangeEntry, FlowsheetRangeShow } from "@wxyc/shared";
import { STATION_TIME_ZONE } from "@/src/utilities/stationTime";
import { CLASSIC_SHOW_PANEL_ID } from "./ClassicWeekGrid";
import "@/src/styles/classic/schedule-week.css";

const timeOf = (entry: FlowsheetRangeEntry) => {
  // A breakpoint is logged roughly a minute before the hour it marks, so its
  // add_time reads an hour early. radio_hour is the hour it stands for.
  const source =
    entry.entry_type === "breakpoint" && entry.radio_hour != null
      ? new Date(entry.radio_hour)
      : entry.add_time
        ? new Date(entry.add_time)
        : null;
  if (!source || Number.isNaN(source.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: STATION_TIME_ZONE,
    hour: "numeric",
    minute: "2-digit",
  }).format(source);
};

export default function ClassicShowEntries({
  show,
  entries,
  isPartial,
  isLoading,
}: {
  show: FlowsheetRangeShow;
  entries: FlowsheetRangeEntry[];
  isPartial: boolean;
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
          Showing the {entries.length} entries logged during this week. This show
          began before the week started, and the rest are in the previous week.
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
                    <em>{entry.message ?? entry.entry_type}</em>
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
