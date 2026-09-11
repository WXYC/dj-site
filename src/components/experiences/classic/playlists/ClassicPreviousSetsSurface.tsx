"use client";

import { useRef } from "react";
import type { PlaylistSearchResult } from "@wxyc/shared";
import { usePlaylistSearchSubscription } from "@/src/hooks/playlistSearchHooks";
import { useScheduleWeekParams } from "@/src/hooks/scheduleWeekHooks";
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

  // Both of these outlive the listing on purpose. The branch below unmounts it
  // to open a show, which would otherwise drop the walked pages and the offset
  // into them — the two halves of the place the reader was.
  usePlaylistSearchSubscription(!isWeekView && selectedShowId === null);
  const listingScrollTop = useRef(0);

  return (
    <>
      <Navigation />
      <ClassicViewToggle isWeekView={isWeekView} onChange={setView} />
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
