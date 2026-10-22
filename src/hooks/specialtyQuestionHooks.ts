import { useCallback, useMemo, useState } from "react";
import {
  useGetCurrentShowQuery,
  useGetInfiniteEntriesInfiniteQuery,
} from "@/lib/features/flowsheet/api";
import { useGetSpecialtyShowsQuery } from "@/lib/features/specialty/api";
import {
  readDeclinedShows,
  rememberDeclinedShow,
} from "@/lib/features/specialty/declined-storage";
import { programsForStart } from "@/lib/features/specialty/slot-match";
import { useShowControl } from "@/src/hooks/flowsheetHooks";
import { useFlowsheetPollingInterval } from "@/src/hooks/useSSEConnection";

/**
 * The open set this DJ is on, the newest row logged on the flowsheet, and the
 * catalog programs the set could be: empty unless the set is worth asking
 * about, which is untagged, started inside a slot, and not answered "Not this
 * time" in this browser.
 */
export function useSpecialtyQuestion() {
  const { live } = useShowControl();
  const pollingInterval = useFlowsheetPollingInterval();
  const { data } = useGetCurrentShowQuery(undefined, {
    skip: !live,
    pollingInterval,
  });
  const { data: catalog } = useGetSpecialtyShowsQuery(undefined, { skip: !live });
  // Pages stay sorted newest-first; an optimistic row's temp id is replaced by
  // its real one, which still reads as one more row logged.
  const { newestEntryId } = useGetInfiniteEntriesInfiniteQuery(undefined, {
    skip: !live,
    selectFromResult: ({ data }) => ({ newestEntryId: data?.pages[0]?.[0]?.id ?? null }),
  });
  const [declined, setDeclined] = useState(readDeclinedShows);

  // A skipped query keeps its last data, so a DJ who just left still has a show.
  const current = live ? data : null;
  const matches = useMemo(
    () =>
      current && !current.specialty && !declined.includes(current.id)
        ? programsForStart(current.start_time, catalog ?? [])
        : [],
    [current, catalog, declined]
  );

  const decline = useCallback((showId: number) => {
    rememberDeclinedShow(showId);
    setDeclined((ids) => [...ids, showId]);
  }, []);

  return { showId: current?.id ?? null, newestEntryId, matches, decline };
}
