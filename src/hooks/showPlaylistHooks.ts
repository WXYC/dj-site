"use client";

import { useMemo } from "react";
import { useGetShowPlaylistQuery } from "@/lib/features/show-playlist/api";
import { v2ToRangeShape } from "@/lib/features/show-playlist/wire";
import {
  formatStationClockTime,
  formatStationDateTime,
  startOfStationWeek,
  formatStationWeekParam,
} from "@/src/utilities/stationTime";

export type ShowPlaylist = {
  /** Specialty-show name, else the DJ handle, else a stated absence. */
  title: string;
  djName: string | null;
  /** Station-local calendar day the show began. */
  day: string;
  /** "6:00 PM – 9:00 PM", or an open-ended form when sign-off was never logged. */
  timeRange: string;
  /** Week the show belongs to, for the link back to the calendar. */
  weekParam: string;
  entries: ReturnType<typeof v2ToRangeShape>[];
  isLoading: boolean;
  /** The id resolved to no show — a typo or a scraped URL, not an outage. */
  notFound: boolean;
};

export function useShowPlaylist(showId: number): ShowPlaylist {
  const { data, isFetching, error } = useGetShowPlaylistQuery({ showId });

  // Only a 404 means "no such show". A soft-failed body also yields the empty
  // playlist, and telling a DJ their show does not exist because the response
  // failed to parse is a different, wrong claim.
  const notFound = (error as { status?: number } | undefined)?.status === 404;

  return useMemo(() => {
    const start = data?.start_time ?? "";
    // A null end_time means the sign-off was never recorded, which is
    // permanent — it does not mean the show is still on the air, so it is
    // drawn open-ended rather than clipped to now.
    const end = data?.end_time ?? null;

    // The same chain `FlowsheetRangeShow.dj_name` resolves server-side.
    // `show_djs` is empty for every show imported from tubafrenzy — which is
    // most of the archive — so reading it alone leaves historical sets
    // showing no DJ at all.
    const djName =
      data?.dj_name_override ??
      data?.show_djs?.[0]?.dj_name ??
      data?.legacy_dj_name ??
      null;

    return {
      title:
        (data?.specialty_show_name || null) ??
        data?.show_name ??
        djName ??
        "Unattributed show",
      djName,
      day: start ? formatStationDateTime(start).day : "",
      timeRange: start
        ? `${formatStationClockTime(start)} – ${
            end ? formatStationClockTime(end) : "no sign-off recorded"
          }`
        : "",
      weekParam: start
        ? formatStationWeekParam(startOfStationWeek(new Date(start)))
        : "",
      // The route returns entries newest-first; a set reads in the order it
      // aired. tubafrenzy asked for "ASC" explicitly for the same reason.
      entries: [...(data?.entries ?? [])]
        .sort((a, b) => a.play_order - b.play_order)
        .map(v2ToRangeShape),
      isLoading: isFetching,
      notFound,
    };
  }, [data, isFetching, notFound]);
}
