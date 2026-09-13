"use client";

import { useRef } from "react";
import type { PlaylistSearchResult } from "@wxyc/shared";
import { usePlaylistSearchSubscription } from "@/src/hooks/playlistSearchHooks";
import { useScheduleWeekParams } from "@/src/hooks/scheduleWeekHooks";
import { useShowPlaylist } from "@/src/hooks/showPlaylistHooks";
import { ClassicScheduleWeek } from "@/src/components/experiences/classic/schedule-week";
import Navigation from "@/src/components/experiences/classic/Navigation";
import PreviousSetsContainer from "./PreviousSetsContainer";
import ShowView from "./ShowView";
import ClassicViewToggle from "./ClassicViewToggle";

/**
 * Owns the Search-vs-Week branch for Classic. The page above stays a Server
 * Component so it can seed the default listing; the branch reads the URL via
 * useSearchParams and so has to be on the client.
 *
 * Renders `Navigation` itself rather than the page wrapping it in
 * `Layout/Main`, as the classic flowsheet's own Main does: that shell centres
 * its whole subtree, which would re-centre both the results table and the week
 * grid.
 */
export default function ClassicPreviousSetsSurface({
  initialResults,
}: {
  initialResults?: readonly PlaylistSearchResult[];
}) {
  const { isWeekView, setView, selectedShowId, selectedEntryId } =
    useScheduleWeekParams();

  // The open show's own week, so the Week toggle lands on the calendar
  // surrounding the set being read rather than on the current week. Shares the
  // cache entry ShowView reads, so this is a second subscription and not a
  // second request; null while nothing is open, where the toggle's own
  // URL-derived week is already right.
  const { weekParam: openShowWeek } = useShowPlaylist(selectedShowId);

  // Both of these outlive the listing on purpose. The branch below unmounts it
  // to open a show, which would otherwise drop the walked pages and the offset
  // into them — the two halves of the place the reader was.
  usePlaylistSearchSubscription(!isWeekView && selectedShowId === null);
  const listingScrollTop = useRef(0);

  return (
    <>
      <Navigation />
      <ClassicViewToggle
        isWeekView={isWeekView}
        onChange={(view) => setView(view, openShowWeek || null)}
      />
      {selectedShowId !== null ? (
        <ShowView showId={selectedShowId} highlightedEntryId={selectedEntryId} />
      ) : isWeekView ? (
        <ClassicScheduleWeek />
      ) : (
        <PreviousSetsContainer
          initialResults={initialResults}
          retainedScrollTop={listingScrollTop}
        />
      )}
    </>
  );
}
