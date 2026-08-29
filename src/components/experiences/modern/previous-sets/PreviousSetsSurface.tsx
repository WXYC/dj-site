"use client";

import { Box } from "@mui/joy";
import type { PlaylistSearchResult } from "@wxyc/shared";
import { useScheduleWeekParams } from "@/src/hooks/scheduleWeekHooks";
import { ScheduleWeekView } from "@/src/components/experiences/modern/schedule-week";
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
  const { isWeekView, setView } = useScheduleWeekParams();

  return (
    <>
      <Box sx={{ display: "flex", justifyContent: "flex-end", pt: 1 }}>
        <ViewToggle isWeekView={isWeekView} onChange={setView} />
      </Box>

      {isWeekView ? (
        <ScheduleWeekView />
      ) : (
        <>
          <SearchBar />
          <Results initialResults={initialResults} />
        </>
      )}
    </>
  );
}
