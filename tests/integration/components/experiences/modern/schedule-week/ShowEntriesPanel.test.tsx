import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders as render } from "@/tests/helpers";
import ShowEntriesPanel from "@/src/components/experiences/modern/schedule-week/ShowEntriesPanel";
import type { FlowsheetRangeEntry, FlowsheetRangeShow } from "@wxyc/shared";
import { FlowsheetEntryType } from "@wxyc/shared/dtos";

// The drill-in renders the live flowsheet's own row elements, so the row's
// live-show hooks are the one thing that would otherwise decide whether an
// archived set is editable. Stubbed here so the read-only guarantee can be
// asserted against the worst case rather than an incidental false.
const showControl = vi.fn();
const liveStatus = vi.fn();
vi.mock("@/src/hooks/flowsheetHooks", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/src/hooks/flowsheetHooks")>();
  return {
    ...actual,
    useShowControl: () => showControl(),
    useLiveStatus: () => liveStatus(),
  };
});

// Above xl the artist and label take their own columns; below they stack. Both
// layouts have to satisfy the same column contract, so the breakpoint is driven
// rather than left to jsdom's matchMedia stub.
const isXl = vi.fn();
vi.mock("@/src/hooks/useMediaQuery", () => ({
  useMediaQuery: () => isXl(),
}));

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
    request_flag: false,
    artist_name: "Jessica Pratt",
    track_title: "Back, Baby",
    album_title: "On Your Own Love Again",
    ...over,
  }) as unknown as FlowsheetRangeEntry;

const panel = (entries: FlowsheetRangeEntry[]) => (
  <ShowEntriesPanel
    show={show}
    entries={entries}
    isPartial={false}
    partialEdge={null}
    isLoading={false}
  />
);

const row = (id: number) => screen.getByTestId(`flowsheet-entry-${id}`);

// A row's column units: the cells it renders, counting a colSpan as the number
// of units it covers.
const columnUnits = (tr: Element, xl: boolean) =>
  [...tr.children]
    .filter(
      (cell) =>
        xl ||
        !(
          cell.classList.contains("col-artist") ||
          cell.classList.contains("col-label")
        )
    )
    .reduce((n, cell) => n + (Number(cell.getAttribute("colspan")) || 1), 0);

describe("ShowEntriesPanel", () => {
  beforeEach(() => {
    showControl.mockReturnValue({
      live: false,
      autoplay: false,
      currentShow: -1,
    });
    liveStatus.mockReturnValue({
      live: false,
      loading: false,
      userData: undefined,
      userloading: false,
    });
    isXl.mockReturnValue(false);
  });

  it("lists the show's entries", () => {
    render(panel([entry({ id: 1 })]));
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

  it("reports an empty show rather than rendering a bare table", () => {
    render(panel([]));
    expect(
      screen.getByText(/No entries recorded for this show/),
    ).toBeInTheDocument();
  });

  describe("marker rows", () => {
    it("gives the show markers the flowsheet's copy and iconography", () => {
      render(
        panel([
          entry({ id: 10, entry_type: "show_start", dj_name: "DJ Chowder" }),
          entry({ id: 11, entry_type: "show_end", dj_name: "DJ Chowder" }),
        ]),
      );

      // The markers carry no message at all, so a `message ?? entry_type`
      // fallback opens and closes every panel with a wire token.
      expect(screen.queryByText("show_start")).toBeNull();
      expect(screen.queryByText("show_end")).toBeNull();
      expect(screen.getByText("started the set")).toBeInTheDocument();
      expect(screen.getByText("ended the set")).toBeInTheDocument();
      expect(row(10).querySelector("svg")).toBeInTheDocument();
      expect(row(11).querySelector("svg")).toBeInTheDocument();
    });

    it("gives a talkset its own row treatment rather than a grey line", () => {
      // The raw range column is the uppercase legacy token; the presentation
      // switch keys on the normalized spelling.
      render(panel([entry({ id: 12, entry_type: "talkset", message: "TALKSET" })]));

      expect(screen.getByText("Talkset")).toBeInTheDocument();
      expect(row(12)).toHaveClass("row-marker");
      expect(row(12).querySelector("svg")).toBeInTheDocument();
    });

    it("labels a breakpoint by the hour it marks, not the minute it was logged", () => {
      render(
        panel([
          entry({
            id: 3,
            entry_type: "breakpoint",
            message: "--- 9:00 PM BREAKPOINT ---",
            // Logged a minute before the hour it stands for.
            add_time: "2026-08-23T00:59:00.000Z",
            radio_hour: "2026-08-23T01:00:00.000Z",
          }),
        ]),
      );

      expect(screen.getByText("9:00 PM Breakpoint")).toBeInTheDocument();
      expect(screen.getByText("9:00 PM")).toBeInTheDocument();
      expect(screen.queryByText("8:59 PM")).not.toBeInTheDocument();
    });

    // Sourced from the contract enum rather than sampled data: dj_join and
    // dj_leave are rare enough that a sampled day holds none, and a missing arm
    // makes the row vanish silently.
    it.each(Object.values(FlowsheetEntryType))(
      "renders a %s row with visible content",
      (entry_type) => {
        render(
          panel([
            entry({
              id: 42,
              entry_type,
              dj_name: "DJ Chowder",
              message: "TALKSET",
              radio_hour: "2026-08-23T01:00:00.000Z",
            }),
          ]),
        );

        expect(row(42).textContent?.replace(/\s/g, "")).not.toBe("");
      },
    );
  });

  describe("song rows", () => {
    it("shows the bin a playcut aired under", () => {
      render(panel([entry({ id: 20, rotation_bin: "H" })]));
      expect(screen.getByLabelText("Rotation H")).toBeInTheDocument();
    });

    it("shows no rotation chip for a playcut that was never in rotation", () => {
      render(panel([entry({ id: 21 })]));
      expect(screen.queryByLabelText(/^Rotation /)).toBeNull();
    });

    it("shows the request, segue and exclusive states a read-only row carries", () => {
      render(
        panel([
          entry({
            id: 22,
            request_flag: true,
            segue: true,
            on_streaming: false,
          } as Partial<FlowsheetRangeEntry> & { id: number }),
        ]),
      );

      expect(screen.getByText("REQ")).toBeInTheDocument();
      expect(screen.getByText("SEGUE")).toBeInTheDocument();
      expect(screen.getByText("EXCLUSIVE")).toBeInTheDocument();
    });
  });

  describe("read-only", () => {
    it("reaches no editing affordance even while the DJ is live on this show", () => {
      // The live row computes editability from show control, which would make
      // an archival view of someone else's set depend on live-show state. The
      // panel says read-only outright, so the worst case is the real test.
      showControl.mockReturnValue({
        live: true,
        autoplay: false,
        currentShow: show.id,
      });
      liveStatus.mockReturnValue({
        live: true,
        loading: false,
        userData: { id: "dj-1" },
        userloading: false,
      });

      render(
        panel([
          entry({ id: 30 }),
          entry({ id: 31, entry_type: "talkset", message: "TALKSET" }),
        ]),
      );

      expect(screen.queryByLabelText("Segue from previous track")).toBeNull();
      expect(screen.queryByLabelText("Requested track")).toBeNull();
      expect(screen.queryByLabelText("Edit artist")).toBeNull();
      expect(screen.queryByLabelText("Edit song")).toBeNull();
      expect(screen.queryByTestId("flowsheet-remove-30")).toBeNull();
      expect(screen.queryByTestId("flowsheet-remove-31")).toBeNull();
      expect(document.querySelector(".drag-grip")).toBeNull();
      expect(
        screen.queryByRole("button", { name: /Play this song now/i }),
      ).toBeNull();
    });
  });

  describe("column contract", () => {
    // Every row type must render the same column units as the sizing row or
    // fixed-layout sizing silently degrades, and the drill-in's leading Time
    // column adds one to both halves at once.
    it.each([true, false])(
      "renders every row on the sizing row's column count (xl: %s)",
      (xl) => {
        isXl.mockReturnValue(xl);
        render(
          panel([
            entry({ id: 40 }),
            entry({ id: 41, entry_type: "show_start", dj_name: "DJ Chowder" }),
            entry({ id: 43, entry_type: "talkset", message: "TALKSET" }),
          ]),
        );

        const table = screen.getByRole("table");
        const sizingRow = table.querySelector("thead tr")!;
        const expected = columnUnits(sizingRow, xl);

        for (const tr of table.querySelectorAll("tbody tr")) {
          expect(columnUnits(tr, xl)).toBe(expected);
        }
      },
    );

    it("gives every row a leading time cell", () => {
      render(panel([entry({ id: 50 }), entry({ id: 51, entry_type: "show_start", dj_name: "DJ Chowder" })]));

      for (const id of [50, 51]) {
        expect(row(id).firstElementChild).toHaveClass("col-time");
      }
    });
  });
});
