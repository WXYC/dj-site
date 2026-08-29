import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders as render } from "@/tests/helpers";
import ClassicWeekGrid, {
  CLASSIC_SHOW_PANEL_ID,
} from "@/src/components/experiences/classic/schedule-week/ClassicWeekGrid";
import { buildWeekGrid } from "@/lib/features/schedule-week/layout";
import { startOfStationWeek } from "@/src/utilities/stationTime";
import type { FlowsheetRangeResponse } from "@wxyc/shared";

const WEEK = startOfStationWeek(new Date("2026-08-26T12:00:00Z"));
const NOW = new Date(WEEK.getTime() + 8 * 86_400_000);
const at = (d: number, h: number) =>
  new Date(WEEK.getTime() + d * 86_400_000 + h * 3_600_000).toISOString();

const show = (over: Record<string, unknown>) => ({
  show_name: null,
  dj_name: "DJ Chowder",
  specialty_id: null,
  ...over,
});

const grid = (shows: unknown[]) =>
  buildWeekGrid({ shows, entries: [] } as FlowsheetRangeResponse, WEEK, NOW);

describe("ClassicWeekGrid", () => {
  it("reproduces the source stylesheet's class names", () => {
    // The visual parity of this screen is carried entirely by these class
    // names; renaming one silently changes the page rather than breaking it.
    const { container } = render(
      <ClassicWeekGrid
        columns={grid([
          show({ id: 1, start_time: at(2, 6), end_time: at(2, 9) }),
        ]).columns}
        selectedShowId={null}
        onSelectShow={vi.fn()}
      />,
    );
    for (const className of [
      "radioDayHeader",
      "radioShowDisplayBlock",
      "radioDayNonshow",
      "radioDayLine",
      "endOfDay",
    ]) {
      expect(container.querySelector(`.${className}`)).not.toBeNull();
    }
  });

  it("heads each column with the station weekday and date", () => {
    const { container } = render(
      <ClassicWeekGrid
        columns={grid([]).columns}
        selectedShowId={null}
        onSelectShow={vi.fn()}
      />,
    );
    // Weekday and date share one heading element, separated by a <br>, as the
    // source JSP wrote them.
    const headings = [...container.querySelectorAll(".radioDayHeader")].map(
      (el) => el.textContent,
    );
    expect(headings).toHaveLength(7);
    expect(headings[0]).toBe("Sunday08/23/2026");
    expect(headings[6]).toBe("Saturday08/29/2026");
  });

  it("makes each show a button that announces the panel it expands", () => {
    render(
      <ClassicWeekGrid
        columns={grid([
          show({ id: 7, start_time: at(3, 6), end_time: at(3, 9) }),
        ]).columns}
        selectedShowId={7}
        onSelectShow={vi.fn()}
      />,
    );
    const button = screen.getByRole("button", { name: /DJ Chowder/ });
    expect(button).toHaveAttribute("aria-controls", CLASSIC_SHOW_PANEL_ID);
    expect(button).toHaveAttribute("aria-expanded", "true");
  });

  it("keeps an accessible name on a block too short to hold text", () => {
    // The source JSP printed nothing under 44 minutes, leaving a sliver with
    // no name at all.
    render(
      <ClassicWeekGrid
        columns={grid([
          show({ id: 9, start_time: at(4, 6), end_time: at(4, 6.2) }),
        ]).columns}
        selectedShowId={null}
        onSelectShow={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: /DJ Chowder/ })).toBeInTheDocument();
  });

  it("draws a midnight-spanning show in both of its days", () => {
    render(
      <ClassicWeekGrid
        columns={grid([
          show({ id: 42, start_time: at(1, 22), end_time: at(2, 2) }),
        ]).columns}
        selectedShowId={null}
        onSelectShow={vi.fn()}
      />,
    );
    expect(screen.getAllByRole("button", { name: /DJ Chowder/ })).toHaveLength(2);
  });
});
