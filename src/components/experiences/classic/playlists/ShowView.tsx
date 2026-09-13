"use client";

import Link from "next/link";
import {
  useScrollToShowEntry,
  useShowPlaylist,
} from "@/src/hooks/showPlaylistHooks";
import ClassicShowEntries from "@/src/components/experiences/classic/schedule-week/ClassicShowEntries";
import { hrefForShow } from "@/lib/features/schedule-week/showUrl";
import "@/src/styles/classic/wxyc.css";
import "@/src/styles/classic/schedule-week.css";

/**
 * One archived show, reached by navigating to it rather than by expanding it
 * under the calendar.
 *
 * Reproduces `flowsheetRadioShowDisplayPublic.jsp`'s `show-info-bar`: date,
 * rounded time range, the DJ handle, a link back to the week, and the walk to
 * either neighbouring show. The week is derived from the show's own
 * `start_time`, not from whatever week the visitor arrived through, so the link
 * cannot carry an id belonging to a different one; the neighbours come from the
 * show read for the same reason, and so the walk crosses a week boundary
 * without the calendar's help.
 */
export default function ShowView({
  showId,
  highlightedEntryId = null,
}: {
  showId: number;
  /** The playcut a search result linked to, marked and scrolled to on arrival. */
  highlightedEntryId?: number | null;
}) {
  const show = useShowPlaylist(showId);

  useScrollToShowEntry(highlightedEntryId, show.entries.length);

  if (show.notFound) {
    return (
      <div className="classic-schedule-week">
        <p className="redlabel" style={{ textAlign: "center" }}>
          No show with that id. It may have been removed.
        </p>
        <p style={{ textAlign: "center" }}>
          <Link href="?view=week">Back to the weekly view</Link>
        </p>
      </div>
    );
  }

  return (
    <div className="classic-schedule-week">
      <table className="show-info-bar">
        <tbody>
          <tr>
            <th style={{ width: "20%" }} className="redlabel">
              WXYC 89.3 FM
            </th>
            <th style={{ width: "40%" }} className="redlabel">
              {show.day}
              <br />
              {show.timeRange}
              <br />
              <Link href={`?view=week&week=${show.weekParam}`}>Weekly View</Link>
              {/* Absent, not disabled, at the archive's ends: there is no show
                  to name, and a dead affordance reads as a broken one. */}
              {show.previousShowId !== null && (
                <>
                  <br />
                  <Link href={hrefForShow(show.previousShowId)}>
                    {"<< Previous Show"}
                  </Link>
                </>
              )}
              {show.nextShowId !== null && (
                <>
                  <br />
                  <Link href={hrefForShow(show.nextShowId)}>
                    {"Next Show >>"}
                  </Link>
                </>
              )}
            </th>
            <th style={{ width: "40%", textAlign: "left" }} className="redlabel">
              {show.djName ? `Disc Jockey: ${show.djName}` : null}
            </th>
          </tr>
        </tbody>
      </table>

      <ClassicShowEntries
        show={{ id: showId, show_name: show.title, dj_name: show.djName } as never}
        entries={show.entries}
        isPartial={false}
        partialEdge={null}
        isLoading={show.isLoading}
        highlightedEntryId={highlightedEntryId}
      />
    </div>
  );
}
