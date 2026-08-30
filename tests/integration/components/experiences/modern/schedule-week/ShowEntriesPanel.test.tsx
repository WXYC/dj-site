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
        partialEdge={null}
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
        partialEdge="before"
        isLoading={false}
      />,
    );
    expect(
      screen.getByText(/Showing the 2 entries logged during this week/),
    ).toBeInTheDocument();
    expect(screen.getByText(/rest are in the previous week/)).toBeInTheDocument();
  });

  it("names the next week when the show ran past this one", () => {
    // A show straddles either edge. Naming the previous week for a show that
    // overran this one sends the DJ looking in the wrong direction.
    render(
      <ShowEntriesPanel
        show={show}
        entries={[entry({ id: 1 })]}
        isPartial
        partialEdge="after"
        isLoading={false}
      />,
    );
    expect(screen.getByText(/rest are in the next week/)).toBeInTheDocument();
    expect(screen.queryByText(/previous week/)).toBeNull();
  });

  it("names the marker rows instead of printing their wire type", () => {
    render(
      <ShowEntriesPanel
        show={show}
        entries={[
          entry({ id: 10, entry_type: "show_start", dj_name: "DJ Chowder" }),
          entry({ id: 11, entry_type: "show_end", dj_name: "DJ Chowder" }),
        ]}
        isPartial={false}
        partialEdge={null}
        isLoading={false}
      />,
    );
    // The markers carry no message at all, so a `message ?? entry_type`
    // fallback opens and closes every panel with a wire token.
    expect(screen.queryByText("show_start")).toBeNull();
    expect(screen.queryByText("show_end")).toBeNull();
    expect(screen.getByText("DJ Chowder started the set")).toBeInTheDocument();
    expect(screen.getByText("DJ Chowder ended the set")).toBeInTheDocument();
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
        partialEdge={null}
        isLoading={false}
      />,
    );
    expect(screen.getByText("9:00 PM Breakpoint")).toBeInTheDocument();
    expect(screen.getByText("9:00 PM")).toBeInTheDocument();
    expect(screen.queryByText("8:59 PM")).not.toBeInTheDocument();
  });

  it("reports an empty show rather than rendering a bare table", () => {
    render(
      <ShowEntriesPanel
        show={show}
        entries={[]}
        isPartial={false}
        partialEdge={null}
        isLoading={false}
      />,
    );
    expect(screen.getByText(/No entries recorded for this show/)).toBeInTheDocument();
  });
});
