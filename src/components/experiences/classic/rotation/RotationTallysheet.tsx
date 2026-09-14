"use client";

import { useMemo, useState } from "react";
import { useGetFlowsheetRangeQuery } from "@/lib/features/schedule-week/api";
import {
  formatWeeklyReport,
  formatWeekRange,
  rankWeeklyPlays,
} from "@/lib/features/rotation-tally/tally";
import {
  addStationWeeks,
  startOfStationWeek,
  stationWeekWindow,
} from "@/src/utilities/stationTime";
import "@/src/styles/classic/wxyc.css";

/**
 * `/wxycdb`'s Format Tallysheets, rebuilt against the flowsheet Backend holds.
 *
 * The JSP is two screens because its first action is a write:
 * `calculateWeeklyPlaylist` deletes the week's stored counts, recomputes them
 * from the flowsheet, and lands on a sheet the music director hand-corrects
 * before the summary is read. Nothing here is stored, so there is nothing to
 * recalculate and nothing to correct — the figures are compiled on read, which
 * collapses `weeklySummarySelect.jsp` and `sortedWeeklyPlays.jsp` into one
 * screen. What that costs is the MD's corrections; what it buys is a report
 * that exists at all, which the stored path no longer has a feed for.
 *
 * The email form is deliberately absent. The report has always been mailed by
 * hand out of the librarian's own client, so the `<pre>` below is the product.
 */

// `weeklySummarySelect.jsp` loops x from 0 down to -8.
const WEEKS_OFFERED = 9;
// The JSP's own hidden default is 3, but the station's report is compiled at 1
// — it carries every record that aired at all, down to a single play.
const DEFAULT_MINIMUM_PLAYS = 1;

export default function RotationTallysheet() {
  // Defaults to last week, not this one: the report is compiled after the week
  // it covers has ended.
  const [weekOffset, setWeekOffset] = useState(-1);
  const [minimumPlays, setMinimumPlays] = useState(DEFAULT_MINIMUM_PLAYS);

  const thisWeek = useMemo(() => startOfStationWeek(new Date()), []);
  const weekStart = useMemo(
    () => addStationWeeks(thisWeek, weekOffset),
    [thisWeek, weekOffset],
  );

  const { data, isFetching, isError } = useGetFlowsheetRangeQuery(
    stationWeekWindow(weekStart),
  );

  const report = useMemo(() => {
    const ranked = rankWeeklyPlays(
      data?.shows ?? [],
      data?.entries ?? [],
      minimumPlays,
    );
    return formatWeeklyReport(ranked, weekStart);
  }, [data, minimumPlays, weekStart]);

  const weeks = useMemo(
    () =>
      Array.from({ length: WEEKS_OFFERED }, (_, i) => {
        const offset = -i;
        return { offset, label: formatWeekRange(addStationWeeks(thisWeek, offset)) };
      }),
    [thisWeek],
  );

  return (
    <div>
      <h2 className="bigblue" style={{ textAlign: "center" }}>
        Weekly Playlist Summary
      </h2>

      <table align="center">
        <tbody>
          <tr>
            <td className="text" align="right">
              Week:
            </td>
            <td>
              <select
                aria-label="Week"
                value={weekOffset}
                onChange={(e) => setWeekOffset(Number(e.target.value))}
              >
                {weeks.map((w) => (
                  <option key={w.offset} value={w.offset}>
                    {w.label}
                  </option>
                ))}
              </select>
            </td>
          </tr>
          <tr>
            <td className="text" align="right">
              Minimum # of plays required to make the list:
            </td>
            <td>
              <select
                aria-label="Minimum number of plays"
                value={minimumPlays}
                onChange={(e) => setMinimumPlays(Number(e.target.value))}
              >
                {Array.from({ length: 10 }, (_, n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </td>
          </tr>
        </tbody>
      </table>

      {isError && (
        <p className="redlabel" style={{ textAlign: "center" }}>
          The flowsheet for that week could not be read, so no tally can be
          compiled. Try again, or pick another week.
        </p>
      )}

      {/* The count is compiled from the whole week at once, so a partial
          render would show a chart that is wrong rather than incomplete. */}
      {isFetching ? (
        <p className="text" style={{ textAlign: "center" }}>
          Compiling the week&apos;s plays...
        </p>
      ) : (
        !isError && <pre>{report}</pre>
      )}
    </div>
  );
}
