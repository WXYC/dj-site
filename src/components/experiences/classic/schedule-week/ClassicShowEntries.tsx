"use client";

import { Fragment } from "react";
import type { FlowsheetRangeShow } from "@wxyc/shared";
import type { FlowsheetRangeEntryWire } from "@/lib/features/flowsheet/conversions";
import { formatStationClockTime } from "@/src/utilities/stationTime";
import { describeNonTrackEntry } from "@/lib/features/schedule-week/entryLabel";
import { entryAnchorId } from "@/lib/features/schedule-week/showUrl";
import {
  Capsule,
  capsulesForSongEntry,
} from "@/src/components/experiences/classic/flowsheet/Capsule";
import "@/src/styles/classic/wxyc.css";
import "@/src/styles/classic/schedule-week.css";

// Time · [indicators] · Artist · Song · Release · Label. A marker row keeps its
// own Time cell and spans the rest, so a column added to the header below has
// to be counted here as well; nothing derives this from the header.
//
// Time is dj-site's own column — the JSP this reproduces ships five, starting at
// the indicator gutter. Print drops it back to five (see the print block in
// wxyc.css), which is why the Time cells are named rather than left to be
// selected by position; `MARKER_SPAN` still covers the rest of the row either
// way, since hiding a column leaves the marker spanning all that remain.
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

const isMarker = (entry: FlowsheetRangeEntryWire) =>
  entry.entry_type != null && entry.entry_type !== "track";

// The row classes tubafrenzy's `.entry-table` family styles, assigned exactly
// as flowsheetRadioShowDisplayPublic.jsp assigns them: talksets get their own
// row, every other non-track marker is a breakpoint row, and the zebra phase
// comes from the entry's absolute position — markers included — rather than
// from a count of the tracks alone.
const rowClass = (entry: FlowsheetRangeEntryWire, index: number) => {
  if (isMarker(entry))
    return entry.entry_type === "talkset" ? "talkset-row" : "breakpoint-row";
  return `entry-row ${index % 2 === 0 ? "entry-row-even" : "entry-row-odd"}`;
};

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
        <table className="entry-table">
          <thead>
            <tr className="entry-header">
              <th className="classic-schedule-week-time" style={{ width: "5em" }}>
                Time
              </th>
              <th className="classic-indicator-cell" />
              <th style={{ width: "25%" }}>Artist</th>
              <th>Song</th>
              <th>Release</th>
              <th>Label</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry, index) => (
              <tr
                key={entry.id}
                id={
                  entry.id === highlightedEntryId
                    ? entryAnchorId(entry.id)
                    : undefined
                }
                className={
                  entry.id === highlightedEntryId
                    ? `${rowClass(entry, index)} playlistEntryHighlight`
                    : rowClass(entry, index)
                }
              >
                <td className="classic-schedule-week-time">{timeOf(entry)}</td>
                {isMarker(entry) ? (
                  // Alignment is set here rather than in the stylesheet because
                  // that is where the JSP sets it: `.breakpoint-row td` declares
                  // `center` and every breakpoint then overrides it inline.
                  <td
                    colSpan={MARKER_SPAN}
                    style={{
                      textAlign:
                        entry.entry_type === "talkset" ? "center" : "left",
                    }}
                  >
                    {describeNonTrackEntry(entry)}
                  </td>
                ) : (
                  <>
                    <td className="classic-indicator-cell">
                      {capsulesFor(entry).map((capsule, position) => (
                        <Fragment key={capsule.variant}>
                          {/* The gap between adjacent capsules is the space the
                              JSP prints after each one; neither badge carries a
                              margin of its own. */}
                          {position > 0 ? " " : null}
                          <Capsule
                            variant={capsule.variant}
                            label={capsule.label}
                          />
                        </Fragment>
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
