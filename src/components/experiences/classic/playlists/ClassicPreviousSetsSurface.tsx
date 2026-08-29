"use client";

import type { PlaylistSearchResult } from "@wxyc/shared";
import { useScheduleWeekParams } from "@/src/hooks/scheduleWeekHooks";
import { ClassicScheduleWeek } from "@/src/components/experiences/classic/schedule-week";
import PreviousSetsContainer from "./PreviousSetsContainer";
import ClassicViewToggle from "./ClassicViewToggle";

/**
 * Owns the Search-vs-Week branch for Classic. The page above stays a Server
 * Component so it can seed the default listing; the branch reads the URL via
 * useSearchParams and so has to be on the client.
 */
export default function ClassicPreviousSetsSurface({
  initialResults,
}: {
  initialResults?: readonly PlaylistSearchResult[];
}) {
  const { isWeekView, setView } = useScheduleWeekParams();

  return (
    <>
      <ClassicViewToggle isWeekView={isWeekView} onChange={setView} />
      {isWeekView ? (
        <ClassicScheduleWeek />
      ) : (
        <PreviousSetsContainer initialResults={initialResults} />
      )}
    </>
  );
}
