import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import type { FlowsheetRangeEntry, FlowsheetRangeShow } from "@wxyc/shared";

const mockReplace = vi.fn();
let searchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace }),
  usePathname: () => "/dashboard/playlists",
  useSearchParams: () => searchParams,
}));

// Records the window every range query asks for, so the supplement's bounds
// can be asserted directly rather than inferred from what came back.
const requestedWindows: Array<{ startMs: number; endMs: number }> = [];
let rangeResult: {
  data?: { shows: unknown[]; entries: unknown[] };
  isFetching: boolean;
  isError: boolean;
} = { data: undefined, isFetching: false, isError: false };

vi.mock("@/lib/features/schedule-week/api", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/features/schedule-week/api")>();
  return {
    ...actual,
    useGetFlowsheetRangeQuery: (
      window: { startMs: number; endMs: number },
      options?: { skip?: boolean },
    ) => {
      if (!options?.skip) requestedWindows.push(window);
      return options?.skip
        ? { data: undefined, isFetching: false, isError: false }
        : rangeResult;
    },
  };
});

import {
  useScheduleWeekParams,
  useShowEntries,
} from "@/src/hooks/scheduleWeekHooks";
import { stationWeekWindow, startOfStationWeek } from "@/src/utilities/stationTime";

const DAY = 86_400_000;

function show(over: Partial<FlowsheetRangeShow> & { id: number }): FlowsheetRangeShow {
  return {
    show_name: null,
    dj_name: "DJ Chowder",
    specialty_id: null,
    start_time: new Date("2026-08-22T20:36:00.000Z").toISOString(),
    end_time: null,
    ...over,
  } as FlowsheetRangeShow;
}

beforeEach(() => {
  mockReplace.mockReset();
  searchParams = new URLSearchParams();
  requestedWindows.length = 0;
  rangeResult = { data: undefined, isFetching: false, isError: false };
});

describe("useShowEntries supplement window", () => {
  const WEEK = startOfStationWeek(new Date("2026-08-26T12:00:00Z"));
  const WINDOW = stationWeekWindow(WEEK);

  it("does not ask for a multi-year window when an old show was never closed", () => {
    // A show from a past week with no sign-off is an unclosed record, not one
    // still on the air. Read as running, its span reaches from then to now and
    // the endpoint rejects the request outright — which reaches the DJ as a
    // raw backend error, once per click.
    const old = show({
      id: 1,
      start_time: new Date("2019-10-08T02:00:00.000Z").toISOString(),
      end_time: null,
    });
    const now = new Date("2026-08-29T12:00:00.000Z");

    renderHook(() => useShowEntries(old, [], WINDOW, now));

    const supplement = requestedWindows.at(-1)!;
    expect(supplement.endMs - supplement.startMs).toBeLessThanOrEqual(8 * DAY);
  });

  it("reaches past the show's end so the sign-off row is inside the window", () => {
    // The window is half-open and the row that closes a show is logged at the
    // show's own end instant, so a window ending exactly there drops it. Every
    // closed show has one, and its absence reads as a truncated set.
    const closed = show({
      id: 2,
      start_time: new Date("2026-08-23T00:30:00.000Z").toISOString(),
      end_time: new Date("2026-08-23T03:00:00.000Z").toISOString(),
    });
    const endMs = new Date(closed.end_time!).getTime();
    // A window that starts before this one, so the show straddles its edge.
    const narrow = { startMs: endMs - DAY, endMs: endMs - 1 };

    renderHook(() => useShowEntries(closed, [], narrow, new Date("2026-08-29T12:00:00Z")));

    const supplement = requestedWindows.at(-1)!;
    expect(supplement.endMs).toBeGreaterThan(endMs);
  });

  it("prefers a show_end marker over the clock for an unclosed show", () => {
    const marker = new Date("2026-08-23T04:01:00.000Z").getTime();
    const unclosed = show({
      id: 3,
      start_time: new Date("2026-08-23T00:36:00.000Z").toISOString(),
      end_time: null,
    });
    const entries = [
      {
        id: 99,
        show_id: 3,
        play_order: 50,
        entry_type: "show_end",
        add_time: new Date(marker).toISOString(),
      },
    ] as unknown as FlowsheetRangeEntry[];
    const narrow = { startMs: marker - DAY, endMs: marker - 1 };

    renderHook(() =>
      useShowEntries(unclosed, entries, narrow, new Date("2026-08-29T12:00:00Z")),
    );

    const supplement = requestedWindows.at(-1)!;
    expect(supplement.endMs).toBeGreaterThan(marker);
    expect(supplement.endMs - supplement.startMs).toBeLessThanOrEqual(8 * DAY);
  });

  it("names the edge the missing entries are on", () => {
    const overran = show({
      id: 4,
      start_time: new Date(WINDOW.endMs - DAY).toISOString(),
      end_time: new Date(WINDOW.endMs + 3_600_000).toISOString(),
    });
    rangeResult = { data: undefined, isFetching: false, isError: false };

    const { result } = renderHook(() =>
      useShowEntries(overran, [], WINDOW, new Date(WINDOW.endMs + DAY)),
    );

    expect(result.current.isPartial).toBe(true);
    expect(result.current.partialEdge).toBe("after");
  });
});

describe("useScheduleWeekParams", () => {
  it("links a show as its own destination, carrying no week", () => {
    // The show view derives its week link from the show's own start_time, so
    // a week carried in this href could only ever disagree with the show.
    searchParams = new URLSearchParams("view=week&week=2026-08-23");

    const { result } = renderHook(() => useScheduleWeekParams());
    const href = result.current.hrefForShow(1951179);

    expect(href).toContain("show=1951179");
    expect(href).not.toContain("week=");
    expect(href).not.toContain("view=");
  });

  it("drops the show when returning to the week view", () => {
    // Reaching the calendar from a show must not land on it still holding
    // that show's id, or the grid renders behind a show that is still open.
    searchParams = new URLSearchParams("show=1951179");

    const { result } = renderHook(() => useScheduleWeekParams());
    result.current.setView("week");

    const url = mockReplace.mock.calls.at(-1)![0] as string;
    expect(url).not.toContain("show=");
    expect(url).toContain("view=week");
  });

  it("pins the week on entering the week view", () => {
    const { result } = renderHook(() => useScheduleWeekParams());
    result.current.setView("week");

    const url = mockReplace.mock.calls.at(-1)![0] as string;
    expect(url).toContain("view=week");
    expect(url).toMatch(/week=\d{4}-\d{2}-\d{2}/);
  });

  it("reads the playcut to highlight from the URL", () => {
    searchParams = new URLSearchParams("show=1951179&entry=901");

    const { result } = renderHook(() => useScheduleWeekParams());

    expect(result.current.selectedEntryId).toBe(901);
  });

  it("highlights nothing for a show opened from the week grid", () => {
    searchParams = new URLSearchParams("show=1951179");

    const { result } = renderHook(() => useScheduleWeekParams());

    expect(result.current.selectedEntryId).toBeNull();
  });

  it.each(["0", "-3", "1.5", "901; drop", ""])(
    "rejects %s as a playcut id",
    (value) => {
      searchParams = new URLSearchParams(`show=1951179&entry=${value}`);

      const { result } = renderHook(() => useScheduleWeekParams());

      expect(result.current.selectedEntryId).toBeNull();
    },
  );

  // The playcut belongs to the show that was open, so every transition that
  // drops the show has to drop it too — otherwise the URL keeps naming a row
  // the screen is no longer showing.
  it.each([
    ["setView('week')", (p: ReturnType<typeof useScheduleWeekParams>) => p.setView("week")],
    ["setView('search')", (p: ReturnType<typeof useScheduleWeekParams>) => p.setView("search")],
    ["setWeek", (p: ReturnType<typeof useScheduleWeekParams>) => p.setWeek(new Date("2026-08-16T12:00:00Z"))],
  ])("drops the playcut on %s", (_name, act) => {
    searchParams = new URLSearchParams("show=1951179&entry=901");

    const { result } = renderHook(() => useScheduleWeekParams());
    act(result.current);

    const url = mockReplace.mock.calls.at(-1)![0] as string;
    expect(url).not.toContain("entry=");
  });
});
