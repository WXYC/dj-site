import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders as render } from "@/tests/helpers";
import WeekHeader from "@/src/components/experiences/modern/schedule-week/WeekHeader";
import {
  formatStationWeekParam,
  startOfStationWeek,
} from "@/src/utilities/stationTime";

const week = (iso: string) => startOfStationWeek(new Date(iso));

describe("WeekHeader", () => {
  const onChangeWeek = vi.fn();
  beforeEach(() => onChangeWeek.mockReset());

  it("names the week's date range in station time", () => {
    render(
      <WeekHeader
        weekStart={week("2026-08-26T12:00:00Z")}
        hasNextWeek
        onChangeWeek={onChangeWeek}
      />,
    );
    expect(screen.getByText(/Aug 23, 2026 – Aug 29, 2026/)).toBeInTheDocument();
  });

  it.each([
    ["Previous week", "2026-08-16"],
    ["Next week", "2026-08-30"],
  ])("moves a whole week when %s is pressed", async (label, expected) => {
    const { user } = render(
      <WeekHeader
        weekStart={week("2026-08-26T12:00:00Z")}
        hasNextWeek
        onChangeWeek={onChangeWeek}
      />,
    );
    await user.click(screen.getByRole("button", { name: label }));
    expect(formatStationWeekParam(onChangeWeek.mock.calls[0][0])).toBe(expected);
  });

  it.each([
    ["spring forward", "2026-03-04T12:00:00Z", "2026-03-08"],
    ["fall back", "2026-10-28T12:00:00Z", "2026-11-01"],
  ])(
    "lands on Sunday midnight across the %s transition",
    async (_label, from, expected) => {
      const { user } = render(
        <WeekHeader
          weekStart={week(from)}
          hasNextWeek
          onChangeWeek={onChangeWeek}
        />,
      );
      await user.click(screen.getByRole("button", { name: "Next week" }));
      expect(formatStationWeekParam(onChangeWeek.mock.calls[0][0])).toBe(
        expected,
      );
    },
  );

  it("refuses to advance past the current week", () => {
    render(
      <WeekHeader
        weekStart={week("2026-08-26T12:00:00Z")}
        hasNextWeek={false}
        onChangeWeek={onChangeWeek}
      />,
    );
    expect(screen.getByRole("button", { name: "Next week" })).toBeDisabled();
  });
});
