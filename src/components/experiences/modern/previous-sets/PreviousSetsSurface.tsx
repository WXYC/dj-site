"use client";

import { useRef } from "react";
import { Box } from "@mui/joy";
import type { PlaylistSearchResult } from "@wxyc/shared";
import { usePlaylistSearchSubscription } from "@/src/hooks/playlistSearchHooks";
import { useScheduleWeekParams } from "@/src/hooks/scheduleWeekHooks";
import { useShowPlaylist } from "@/src/hooks/showPlaylistHooks";
import { ScheduleWeekView } from "@/src/components/experiences/modern/schedule-week";
import ShowView from "./ShowView";
import SearchBar from "./Search/SearchBar";
import Results from "./Results/Results";
import ViewToggle from "./ViewToggle";

/**
 * Owns the Search-vs-Week branch.
 *
 * The page above is a Server Component so it can seed the default listing, but
 * the branch itself reads the URL through useSearchParams and so has to live on
 * the client. Splitting it here keeps toggling a client transition instead of a
 * server round-trip per click.
 */
export default function PreviousSetsSurface({
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

  const listingVisible = !isWeekView && selectedShowId === null;

  // Both of these outlive the listing on purpose. The branch below unmounts it
  // to open a show, which would otherwise drop the walked pages and the offset
  // into them — the two halves of the place the reader was.
  usePlaylistSearchSubscription(listingVisible);
  const listingScrollTop = useRef(0);

  return (
    <>
      <Box sx={{ display: "flex", justifyContent: "flex-end", pt: 1 }}>
        <ViewToggle
          isWeekView={isWeekView}
          onChange={(view) => setView(view, openShowWeek || null)}
        />
      </Box>

      {selectedShowId !== null ? (
        <ShowView showId={selectedShowId} highlightedEntryId={selectedEntryId} />
      ) : isWeekView ? (
        <ScheduleWeekView />
      ) : (
        <>
          <SearchBar />
          <Results
            initialResults={initialResults}
            retainedScrollTop={listingScrollTop}
          />
        </>
      )}
    </>
  );
}
