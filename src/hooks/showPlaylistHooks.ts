"use client";

import { useEffect, useMemo } from "react";
import { toast } from "sonner";
import { Authorization } from "@/lib/features/admin/types";
import type { EntryActions } from "@/src/hooks/entryActions";
import { useAuthentication } from "@/src/hooks/authenticationHooks";
import type { SpecialtyShowRef } from "@wxyc/shared";
import { skipToken } from "@reduxjs/toolkit/query";
import {
  refusalSentenceOf,
  useGetShowPlaylistQuery,
  useRemoveShowEntryMutation,
  useReorderShowEntryMutation,
  useUpdateShowEntryMutation,
} from "@/lib/features/show-playlist/api";
import { entryAnchorId } from "@/lib/features/schedule-week/showUrl";
import { specialtySubtitle } from "@/lib/features/specialty/subtitle";
import type { ShowPlaylistEntryWire } from "@/lib/features/show-playlist/types";
import { v2ToRangeShape } from "@/lib/features/show-playlist/wire";
import {
  formatStationClockTime,
  formatStationDateTime,
  startOfStationWeek,
  formatStationWeekParam,
} from "@/src/utilities/stationTime";

export type ShowPlaylist = {
  /** Program name, else the show name, else the DJ handle, else a stated absence. */
  title: string;
  /** The airing's own name beneath a program title; null when it adds nothing. */
  subtitle: string | null;
  specialty: SpecialtyShowRef | null;
  /** The airing's own name as stored, for editing; `subtitle` is what is displayed. */
  showName: string | null;
  /** ISO-8601 instant the show began; empty until the read resolves. */
  startTime: string;
  djName: string | null;
  /** Station-local calendar day the show began. */
  day: string;
  /** "6:00 PM – 9:00 PM", or an open-ended form when sign-off was never logged. */
  timeRange: string;
  /** Week the show belongs to, for the link back to the calendar. */
  weekParam: string;
  /**
   * The show that aired before this one, anywhere in the archive; null only on
   * the earliest show there is.
   */
  previousShowId: number | null;
  /**
   * The show that aired after this one; null only on the most recent. That
   * includes the show currently on the air, deliberately: the only signal
   * available here is a neighbour's `end_time`, and a null one means the
   * sign-off was never recorded rather than that the show is still running, so
   * suppressing on it would dead-end the walk at every abandoned show in the
   * archive instead of at the live one.
   */
  nextShowId: number | null;
  /**
   * Signed off: `end_time` is set, or the newest row is a `show_end` marker
   * (the server's own predicate; a dropped delivery leaves `end_time` null).
   */
  ended: boolean;
  /** Ids of the DJs on the show; empty for a show imported from tubafrenzy. */
  djIds: string[];
  entries: ReturnType<typeof v2ToRangeShape>[];
  isLoading: boolean;
  /** The id resolved to no show — a typo or a scraped URL, not an outage. */
  notFound: boolean;
};

/**
 * `showId` is nullable so a caller with nothing selected can still read this
 * unconditionally. The query is skipped rather than issued for a sentinel id,
 * and two callers holding the same id share one request — RTK Query dedupes by
 * cache key, so reading this beside the component that renders it costs a
 * subscription and no traffic.
 */
export function useShowPlaylist(showId: number | null): ShowPlaylist {
  const { data, isFetching, error } = useGetShowPlaylistQuery(
    showId === null ? skipToken : { showId },
  );

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

    // Array position is not insertion order: the entries are sorted by
    // `play_order` below, so the newest row is the highest id.
    const newestEntry = (data?.entries ?? []).reduce<
      ShowPlaylistEntryWire | undefined
    >((newest, entry) => (!newest || entry.id > newest.id ? entry : newest), undefined);

    const specialty = data?.specialty ?? null;
    const showName = data?.show_name || null;

    return {
      title:
        specialty?.name ??
        (data?.specialty_show_name || null) ??
        showName ??
        djName ??
        "Unattributed show",
      subtitle: specialtySubtitle(specialty, showName),
      specialty,
      showName,
      startTime: start,
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
      ended: end !== null || newestEntry?.entry_type === "show_end",
      djIds: (data?.show_djs ?? []).map((dj) => String(dj.id)),
      previousShowId: data?.previous_show_id ?? null,
      nextShowId: data?.next_show_id ?? null,
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

/**
 * Brings the row an archive link named into view.
 *
 * Scroll position is browser state, not React state, which is the one thing an
 * effect is for. The router does its own fragment scroll on the commit that
 * follows the navigation — when this show is still a client query in flight and
 * no such row exists — and never retries, so the row is left marked at the top
 * of an unscrolled page. `entryCount` is in the deps for exactly that: it is
 * what changes on the commit the rows arrive.
 *
 * The row is reached by id rather than by ref because the two experiences build
 * it differently, and modern's rows come from a memoized component that hands
 * its caller no DOM handle.
 */
export function useScrollToShowEntry(
  entryId: number | null | undefined,
  entryCount: number
): void {
  useEffect(() => {
    if (!entryId || entryCount === 0) return;
    const row = document.getElementById(entryAnchorId(entryId));
    if (!row) return;

    // Deferred a frame so the scroll reads the row's laid-out box rather than
    // the one it had before this commit's styles applied.
    const frame = requestAnimationFrame(() =>
      row.scrollIntoView({ block: "center" })
    );
    return () => cancelAnimationFrame(frame);
  }, [entryId, entryCount]);
}

/**
 * Whether the signed-in account may change this show's rows. The server is the
 * authority and refuses the rest; this only decides whether to offer controls.
 * Music directors and station managers edit any show, open or ended; a DJ can
 * edit only a show that is on the air and that they are on.
 */
export function useCanEditShowRows(show: Pick<ShowPlaylist, "ended" | "djIds">): boolean {
  const { data: auth } = useAuthentication();
  const user = "user" in auth ? auth.user : undefined;
  if (!user) {
    return false;
  }
  return (
    user.authority >= Authorization.MD ||
    (!show.ended && show.djIds.includes(String(user.id)))
  );
}

/**
 * Row actions for a past show. Each write is unwrapped so a refusal can be
 * read; one the page words itself is toasted here, and anything else was
 * already reported by the global error toast.
 */
export function usePastShowEntryActions(showId: number): EntryActions {
  const [update] = useUpdateShowEntryMutation();
  const [remove] = useRemoveShowEntryMutation();
  const [reorder] = useReorderShowEntryMutation();

  return useMemo(() => {
    const settle = (write: Promise<unknown>) => {
      write.catch((error: unknown) => {
        const sentence = refusalSentenceOf(error);
        if (sentence) {
          toast.error(sentence);
        }
      });
    };
    return {
      pastShow: true,
      // A rename's refusal is worded by the row, not toasted here.
      updateFlowsheet: async (params) => {
        try {
          await update({ showId, ...params }).unwrap();
        } catch (error) {
          const sentence = refusalSentenceOf(error) ?? undefined;
          if (sentence && params.data.spotlight_name === undefined) {
            toast.error(sentence);
          }
          return sentence;
        }
        return undefined;
      },
      removeFromFlowsheet: (entry_id) => settle(remove({ showId, entry_id }).unwrap()),
      reorder: ({ id }, new_position) =>
        settle(reorder({ showId, entry_id: id, new_position }).unwrap()),
    };
  }, [showId, update, remove, reorder]);
}
