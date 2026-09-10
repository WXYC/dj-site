"use client";

import type { FlowsheetRangeShow } from "@wxyc/shared";
import type { FlowsheetRangeEntryWire } from "@/lib/features/flowsheet/conversions";
import { formatStationClockTime } from "@/src/utilities/stationTime";
import { describeNonTrackEntry } from "@/lib/features/schedule-week/entryLabel";
import { entryAnchorId } from "@/lib/features/schedule-week/showUrl";
import {
  Capsule,
  capsulesForSongEntry,
} from "@/src/components/experiences/classic/flowsheet/Capsule";
import "@/src/styles/classic/schedule-week.css";

// Time · [indicators] · Artist · Song · Release · Label. A marker row keeps its
// own Time cell and spans the rest, so a column added to the header below has
// to be counted here as well; nothing derives this from the header.
const COLUMN_COUNT = 6;
const MARKER_SPAN = COLUMN_COUNT - 1;

const timeOf = (entry: FlowsheetRangeEntryWire) =>
  // A breakpoint is logged roughly a minute either side of the hour it marks,
  // so its add_time reads the wrong hour. radio_hour is the hour it stands for.
  formatStationClockTime(
    entry.entry_type === "breakpoint" && entry.radio_hour != null
      ? entry.radio_hour
      : entry.add_time
  );

const capsulesFor = (entry: FlowsheetRangeEntryWire) =>
  capsulesForSongEntry({
    request_flag: entry.request_flag,
    rotation: entry.rotation_bin,
    on_streaming: entry.on_streaming,
  });

export default function ClassicShowEntries({
  show,
  entries,
  isPartial,
  partialEdge,
  isLoading,
  highlightedEntryId = null,
}: {
  show: FlowsheetRangeShow;
  entries: FlowsheetRangeEntryWire[];
  isPartial: boolean;
  partialEdge: "before" | "after" | null;
  isLoading: boolean;
  /**
   * The playcut an archive link named. It alone carries the anchor the link's
   * fragment points at; an id on every row would collide across tables.
   */
  highlightedEntryId?: number | null;
}) {
  return (
    <div className="classic-schedule-week-entries">
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
              <th className="classic-indicator-cell" />
              <th>Artist</th>
              <th>Song</th>
              <th>Release</th>
              <th>Label</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr
                key={entry.id}
                id={
                  entry.id === highlightedEntryId
                    ? entryAnchorId(entry.id)
                    : undefined
                }
                className={
                  entry.id === highlightedEntryId
                    ? "playlistEntryHighlight"
                    : undefined
                }
              >
                <td>{timeOf(entry)}</td>
                {entry.entry_type && entry.entry_type !== "track" ? (
                  <td colSpan={MARKER_SPAN}>
                    <em>{describeNonTrackEntry(entry)}</em>
                  </td>
                ) : (
                  <>
                    <td className="classic-indicator-cell">
                      {capsulesFor(entry).map((capsule) => (
                        <Capsule
                          key={capsule.variant}
                          variant={capsule.variant}
                          label={capsule.label}
                        />
                      ))}
                    </td>
                    <td>{entry.artist_name}</td>
                    <td>{entry.track_title}</td>
                    <td>{entry.album_title}</td>
                    <td>{entry.record_label}</td>
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
