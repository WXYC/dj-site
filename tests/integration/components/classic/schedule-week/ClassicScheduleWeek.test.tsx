import { describe, it, expect, vi } from "vitest";
import { renderWithProviders as render, screen } from "@/tests/helpers";
import { buildWeekGrid } from "@/lib/features/schedule-week/layout";
import {
  startOfStationWeek,
  stationWeekWindow,
} from "@/src/utilities/stationTime";

const WEEK = startOfStationWeek(new Date("2026-08-26T12:00:00Z"));
const NOW = new Date("2026-08-29T12:00:00Z");

vi.mock("@/src/hooks/scheduleWeekHooks", () => ({
  useScheduleWeekParams: () => ({
    weekStart: WEEK,
    selectedShowId: null,
    setWeek: vi.fn(),
    toggleShow: vi.fn(),
  }),
  useScheduleWeek: () => ({
    weekStart: WEEK,
    window: stationWeekWindow(WEEK),
    grid: buildWeekGrid({ shows: [], entries: [] } as never, WEEK, NOW),
    shows: [],
    entries: [],
    isLoading: false,
    isError: false,
    hasNextWeek: false,
    now: NOW,
  }),
  useShowEntries: () => ({
    entries: [],
    isPartial: false,
    partialEdge: null,
    isLoading: false,
  }),
}));

import ClassicScheduleWeek from "@/src/components/experiences/classic/schedule-week/ClassicScheduleWeek";

describe("ClassicScheduleWeek", () => {
  it("emits the source's week-header class", () => {
    // The remaining five parity classes are asserted on the grid, which owns
    // them. This one is the container's, and the visual parity of the screen
    // rests on it exactly as much: a rename changes the page rather than
    // breaking it.
    const { container } = render(<ClassicScheduleWeek />);
    expect(container.querySelector(".radioWeekHeader")).not.toBeNull();
  });

  it("captions the week in the source's red styling", () => {
    const { container } = render(<ClassicScheduleWeek />);
    const caption = screen.getByText("08/23/2026 - 08/29/2026");
    expect(caption).toHaveClass("redlabel");
    expect(container.querySelector(".radioWeekHeader")).toContainElement(caption);
  });
});
