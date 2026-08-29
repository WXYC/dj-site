"use client";

import { useCallback, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { FlowsheetRangeEntry, FlowsheetRangeShow } from "@wxyc/shared";
import { useGetFlowsheetRangeQuery } from "@/lib/features/schedule-week/api";
import {
  buildWeekGrid,
  showSpanIsContained,
  type WeekGrid,
} from "@/lib/features/schedule-week/layout";
import {
  addStationWeeks,
  formatStationWeekParam,
  parseStationWeekParam,
  startOfStationWeek,
  stationWeekWindow,
} from "@/src/utilities/stationTime";

export const VIEW_PARAM = "view";
export const WEEK_PARAM = "week";
export const SHOW_PARAM = "show";
export const WEEK_VIEW = "week";

/**
 * View, week, and expanded show live in the URL rather than Redux: a DJ sending
 * a colleague a specific week is the obvious use, and it makes back/forward
 * behave. Three scalars do not justify a slice.
 */
export function useScheduleWeekParams() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const isWeekView = searchParams.get(VIEW_PARAM) === WEEK_VIEW;
  const weekParam = searchParams.get(WEEK_PARAM);
  const showParam = searchParams.get(SHOW_PARAM);

  // An unparseable or absent week falls back to the current one rather than
  // rendering nothing, but a malformed value never silently resolves to some
  // other week -- parseStationWeekParam returns null and this is the fallback.
  const weekStart = useMemo(
    () =>
      (weekParam ? parseStationWeekParam(weekParam) : null) ??
      startOfStationWeek(new Date()),
    [weekParam],
  );

  const selectedShowId = useMemo(() => {
    if (!showParam) return null;
    const parsed = Number(showParam);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  }, [showParam]);

  const write = useCallback(
    (updates: Record<string, string | null>) => {
      const next = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value === null) next.delete(key);
        else next.set(key, value);
      }
      const query = next.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, {
        scroll: false,
      });
    },
    [pathname, router, searchParams],
  );

  const setView = useCallback(
    (view: "search" | "week") =>
      write(
        view === "week"
          ? { [VIEW_PARAM]: WEEK_VIEW }
          : { [VIEW_PARAM]: null, [WEEK_PARAM]: null, [SHOW_PARAM]: null },
      ),
    [write],
  );

  // Changing week drops the expanded show: its id belongs to the week that
  // produced it, and carrying it across would expand nothing.
  const setWeek = useCallback(
    (next: Date) =>
      write({
        [WEEK_PARAM]: formatStationWeekParam(next),
        [SHOW_PARAM]: null,
      }),
    [write],
  );

  const toggleShow = useCallback(
    (showId: number) =>
      write({
        [SHOW_PARAM]: selectedShowId === showId ? null : String(showId),
      }),
    [selectedShowId, write],
  );

  return {
    isWeekView,
    weekStart,
    selectedShowId,
    setView,
    setWeek,
    toggleShow,
  };
}

export type ScheduleWeek = {
  weekStart: Date;
  window: { startMs: number; endMs: number };
  grid: WeekGrid;
  shows: FlowsheetRangeShow[];
  entries: FlowsheetRangeEntry[];
  isLoading: boolean;
  isError: boolean;
  /** True once the requested week has passed, so "next week" can be blocked. */
  hasNextWeek: boolean;
  /** The pinned wall clock this week was rendered against. */
  now: Date;
};

export function useScheduleWeek(weekStart: Date): ScheduleWeek {
  const window = useMemo(() => stationWeekWindow(weekStart), [weekStart]);

  const { data, isFetching, isError } = useGetFlowsheetRangeQuery(window);

  // Read once for the life of the view rather than on every render. An
  // unclosed show clips its block to "now", so a clock consulted during render
  // makes that block's height depend on when React happened to re-render.
  const [now] = useState(() => new Date());

  const grid = useMemo(
    () =>
      buildWeekGrid(data ?? { shows: [], entries: [] }, weekStart, now),
    [data, weekStart, now],
  );

  return {
    weekStart,
    window,
    grid,
    shows: (data?.shows ?? []) as FlowsheetRangeShow[],
    entries: (data?.entries ?? []) as FlowsheetRangeEntry[],
    isLoading: isFetching,
    isError,
    hasNextWeek: addStationWeeks(weekStart, 1).getTime() <= now.getTime(),
    now,
  };
}

const byPlayOrder = (a: FlowsheetRangeEntry, b: FlowsheetRangeEntry) =>
  // The tie-break is required, not defensive: play_order repeats within a show
  // after a reorder, and without a stable second key equal values render in an
  // arbitrary order that changes between passes.
  (a.play_order ?? 0) - (b.play_order ?? 0) || a.id - b.id;

export type ShowEntries = {
  entries: FlowsheetRangeEntry[];
  /** The week's payload holds only part of this show; the rest is elsewhere. */
  isPartial: boolean;
  isLoading: boolean;
};

/**
 * Entries for one show.
 *
 * `shows` is returned on overlap but `entries` is filtered on `add_time`, so a
 * show straddling the window edge comes back whole in the grid and truncated in
 * the entry stream — for a show that ran up to Sunday midnight, that is a
 * couple of rows out of fifty. Every week has one. When the show's span is not
 * contained in the window, its own span is fetched and merged; if that request
 * fails the panel says so rather than presenting the fragment as the whole set.
 */
export function useShowEntries(
  show: FlowsheetRangeShow | null,
  weekEntries: FlowsheetRangeEntry[],
  window: { startMs: number; endMs: number },
  now: Date,
): ShowEntries {
  const inWindow = useMemo(
    () =>
      show
        ? weekEntries.filter((e) => e.show_id === show.id).sort(byPlayOrder)
        : [],
    [show, weekEntries],
  );

  const resolvedEndMs = useMemo(() => {
    if (!show) return 0;
    if (show.end_time) return new Date(show.end_time).getTime();
    const marker = weekEntries.find(
      (e) => e.show_id === show.id && e.entry_type === "show_end",
    );
    if (marker?.add_time) return new Date(marker.add_time).getTime();
    return now.getTime();
  }, [show, weekEntries, now]);

  const needsSupplement =
    show !== null && !showSpanIsContained(show, resolvedEndMs, window);

  const supplementWindow = useMemo(() => {
    if (!show) return { startMs: 0, endMs: 1 };
    const startMs = new Date(show.start_time).getTime();
    // The endpoint requires end > start; an unclosed show can resolve to its
    // own start instant.
    return { startMs, endMs: Math.max(resolvedEndMs, startMs + 3_600_000) };
  }, [show, resolvedEndMs]);

  const {
    data: supplement,
    isFetching,
    isError,
  } = useGetFlowsheetRangeQuery(supplementWindow, { skip: !needsSupplement });

  const entries = useMemo(() => {
    if (!show || !needsSupplement) return inWindow;
    if (!supplement) return inWindow;
    // The two windows overlap by construction, so rows arrive twice.
    const merged = new Map<number, FlowsheetRangeEntry>();
    for (const e of [...inWindow, ...(supplement.entries as FlowsheetRangeEntry[])]) {
      if (e.show_id === show.id) merged.set(e.id, e);
    }
    return [...merged.values()].sort(byPlayOrder);
  }, [show, needsSupplement, supplement, inWindow]);

  return {
    entries,
    isPartial: needsSupplement && (isError || (!supplement && !isFetching)),
    isLoading: needsSupplement && isFetching,
  };
}
