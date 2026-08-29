import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders as render } from "@/tests/helpers";
import ShowEntriesPanel from "@/src/components/experiences/modern/schedule-week/ShowEntriesPanel";
import type { FlowsheetRangeEntry, FlowsheetRangeShow } from "@wxyc/shared";

const show = {
  id: 1951179,
  show_name: null,
  dj_name: "DJ Chowder",
  specialty_id: null,
  start_time: "2026-08-22T20:36:00.000Z",
  end_time: "2026-08-23T00:01:00.000Z",
} as FlowsheetRangeShow;

const entry = (over: Partial<FlowsheetRangeEntry> & { id: number }) =>
  ({
    play_order: 1,
    show_id: show.id,
    add_time: "2026-08-22T21:00:00.000Z",
    entry_type: "track",
    artist_name: "Jessica Pratt",
    track_title: "Back, Baby",
    album_title: "On Your Own Love Again",
    ...over,
  }) as unknown as FlowsheetRangeEntry;

describe("ShowEntriesPanel", () => {
  it("lists the show's entries", () => {
    render(
      <ShowEntriesPanel
        show={show}
        entries={[entry({ id: 1 })]}
        isPartial={false}
        isLoading={false}
      />,
    );
    expect(screen.getByText("Back, Baby")).toBeInTheDocument();
    expect(screen.getByText("Jessica Pratt")).toBeInTheDocument();
  });

  it("says so when the week holds only part of the show", () => {
    // shows is overlap-based while entries is windowed on add_time, so a show
    // straddling the week edge arrives whole in the grid and truncated here.
    // Presenting the fragment as the full set is the failure being prevented.
    render(
      <ShowEntriesPanel
        show={show}
        entries={[entry({ id: 1 }), entry({ id: 2 })]}
        isPartial
        isLoading={false}
      />,
    );
    expect(
      screen.getByText(/Showing the 2 entries logged during this week/),
    ).toBeInTheDocument();
    expect(screen.getByText(/rest are in the previous week/)).toBeInTheDocument();
  });

  it("labels a breakpoint by the hour it marks, not the minute it was logged", () => {
    render(
      <ShowEntriesPanel
        show={show}
        entries={[
          entry({
            id: 3,
            entry_type: "breakpoint",
            message: "9:00 PM Breakpoint",
            // Logged a minute before the hour it stands for.
            add_time: "2026-08-23T00:59:00.000Z",
            radio_hour: "2026-08-23T01:00:00.000Z",
          } as Partial<FlowsheetRangeEntry> & { id: number }),
        ]}
        isPartial={false}
        isLoading={false}
      />,
    );
    expect(screen.getByText("9:00 PM Breakpoint")).toBeInTheDocument();
    expect(screen.getByText("9:00 PM")).toBeInTheDocument();
    expect(screen.queryByText("8:59 PM")).not.toBeInTheDocument();
  });

  it("reports an empty show rather than rendering a bare table", () => {
    render(
      <ShowEntriesPanel show={show} entries={[]} isPartial={false} isLoading={false} />,
    );
    expect(screen.getByText(/No entries recorded for this show/)).toBeInTheDocument();
  });
});
