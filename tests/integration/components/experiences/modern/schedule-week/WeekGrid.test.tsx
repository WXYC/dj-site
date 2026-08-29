import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders as render } from "@/tests/helpers";
import WeekGrid from "@/src/components/experiences/modern/schedule-week/WeekGrid";
import { buildWeekGrid } from "@/lib/features/schedule-week/layout";
import { startOfStationWeek } from "@/src/utilities/stationTime";
import type { FlowsheetRangeResponse } from "@wxyc/shared";

const WEEK = startOfStationWeek(new Date("2026-08-26T12:00:00Z"));
const NOW = new Date(WEEK.getTime() + 8 * 86_400_000);
const at = (d: number, h: number) =>
  new Date(WEEK.getTime() + d * 86_400_000 + h * 3_600_000).toISOString();

const response = (shows: unknown[]): FlowsheetRangeResponse =>
  ({ shows, entries: [] }) as FlowsheetRangeResponse;

describe("WeekGrid", () => {
  it("heads seven day columns", () => {
    const { columns } = buildWeekGrid(response([]), WEEK, NOW);
    render(
      <WeekGrid columns={columns} selectedShowId={null} onSelectShow={vi.fn()} />,
    );
    for (const day of ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]) {
      expect(screen.getByText(new RegExp(`^${day},`))).toBeInTheDocument();
    }
  });

  it("draws a midnight-spanning show in both of its days", () => {
    const { columns } = buildWeekGrid(
      response([
        {
          id: 42,
          show_name: null,
          dj_name: "DJ Chowder",
          specialty_id: null,
          start_time: at(1, 22),
          end_time: at(2, 2),
        },
      ]),
      WEEK,
      NOW,
    );
    render(
      <WeekGrid columns={columns} selectedShowId={null} onSelectShow={vi.fn()} />,
    );
    expect(screen.getAllByRole("button", { name: /DJ Chowder/ })).toHaveLength(2);
  });

  it("reports the clicked show to its caller", async () => {
    const onSelectShow = vi.fn();
    const { columns } = buildWeekGrid(
      response([
        {
          id: 7,
          show_name: "Backwards Music",
          dj_name: "DJ Chowder",
          specialty_id: null,
          start_time: at(3, 6),
          end_time: at(3, 9),
        },
      ]),
      WEEK,
      NOW,
    );
    const { user } = render(
      <WeekGrid
        columns={columns}
        selectedShowId={null}
        onSelectShow={onSelectShow}
      />,
    );
    await user.click(screen.getByRole("button", { name: /Backwards Music/ }));
    expect(onSelectShow).toHaveBeenCalledWith(7);
  });
});
