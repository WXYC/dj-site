import { describe, it, expect } from "vitest";
import type { ComponentProps } from "react";
import { screen, within } from "@testing-library/react";
import type { FlowsheetRangeShow } from "@wxyc/shared";
import { createComponentHarness } from "@/tests/helpers";
import { RotationBin } from "@/lib/features/rotation/types";
import type { FlowsheetRangeEntryWire } from "@/lib/features/flowsheet/conversions";
import ClassicShowEntries from "@/src/components/experiences/classic/schedule-week/ClassicShowEntries";

const show = {
  id: 1951179,
  show_name: null,
  dj_name: "DJ Chowder",
  start_time: "2026-08-22T20:36:00.000Z",
  end_time: "2026-08-23T00:01:00.000Z",
} as FlowsheetRangeShow;

const entry = (
  over: Partial<FlowsheetRangeEntryWire> & { id: number }
): FlowsheetRangeEntryWire =>
  ({
    play_order: 1,
    show_id: show.id,
    add_time: "2026-08-22T21:00:00.000Z",
    entry_type: "track",
    request_flag: false,
    artist_name: "Juana Molina",
    track_title: "la paradoja",
    album_title: "DOGA",
    record_label: "Sonamos",
    ...over,
  }) as FlowsheetRangeEntryWire;

// The type argument is explicit because the harness would otherwise infer the
// prop type from this literal, where an empty `entries` widens to `never[]`.
const setup = createComponentHarness<ComponentProps<typeof ClassicShowEntries>>(
  ClassicShowEntries,
  {
    show,
    entries: [],
    isPartial: false,
    partialEdge: null,
    isLoading: false,
  }
);

const renderEntries = (entries: FlowsheetRangeEntryWire[]) => setup({ entries });

const capsuleLabels = (container: HTMLElement) =>
  [
    ...container.querySelectorAll(
      ".rotation-capsule, .request-capsule, .exclusive-capsule"
    ),
  ].map((c) => c.textContent);

const rowClasses = (container: HTMLElement) =>
  [...container.querySelectorAll("tbody tr")].map((r) => r.className);

describe("ClassicShowEntries", () => {
  it("renders the six columns, the indicator gutter unlabeled", () => {
    const { container } = renderEntries([entry({ id: 1 })]);
    const headers = container.querySelectorAll("thead th");
    expect([...headers].map((h) => h.textContent)).toEqual([
      "Time",
      "",
      "Artist",
      "Song",
      "Release",
      "Label",
    ]);
  });

  it("renders a playcut across all six columns", () => {
    const { container } = renderEntries([entry({ id: 1 })]);
    const cells = container.querySelectorAll("tbody td");
    expect([...cells].map((c) => c.textContent)).toEqual([
      "5:00 PM",
      "",
      "Juana Molina",
      "la paradoja",
      "DOGA",
      "Sonamos",
    ]);
  });

  it("renders no capsule for a playcut carrying none of the flags", () => {
    const { container } = renderEntries([entry({ id: 1 })]);
    expect(capsuleLabels(container)).toEqual([]);
  });

  it("renders a REQUEST capsule for a requested playcut", () => {
    const { container } = renderEntries([
      entry({
        id: 1,
        request_flag: true,
        artist_name: "Jessica Pratt",
        track_title: "Back, Baby",
      }),
    ]);
    expect(capsuleLabels(container)).toEqual(["REQUEST"]);
  });

  it.each([
    [RotationBin.H, "ROTATION H"],
    [RotationBin.M, "ROTATION M"],
    [RotationBin.L, "ROTATION L"],
    [RotationBin.S, "ROTATION S"],
  ])("renders bin %s as %s", (rotation_bin, label) => {
    const { container } = renderEntries([entry({ id: 1, rotation_bin })]);
    expect(capsuleLabels(container)).toEqual([label]);
  });

  it("renders EXCLUSIVE only for a release known not to be on streaming", () => {
    const { container } = renderEntries([entry({ id: 1, on_streaming: false })]);
    expect(capsuleLabels(container)).toEqual(["EXCLUSIVE"]);
  });

  it.each<[string, boolean | null | undefined]>([
    ["null", null],
    ["true", true],
    ["absent", undefined],
  ])(
    "renders no EXCLUSIVE capsule when on_streaming is %s",
    (_name, on_streaming) => {
      const { container } = renderEntries([entry({ id: 1, on_streaming })]);
      expect(capsuleLabels(container)).toEqual([]);
    }
  );

  it("orders the capsules ROTATION, REQUEST, EXCLUSIVE", () => {
    const { container } = renderEntries([
      entry({
        id: 1,
        request_flag: true,
        rotation_bin: RotationBin.H,
        on_streaming: false,
        artist_name: "Chuquimamani-Condori",
        track_title: "Call Your Name",
      }),
    ]);
    expect(capsuleLabels(container)).toEqual([
      "ROTATION H",
      "REQUEST",
      "EXCLUSIVE",
    ]);
  });

  it("keeps a marker row's time cell and spans it across the rest", () => {
    const { container } = renderEntries([
      entry({ id: 2, entry_type: "talkset", message: "TALKSET" }),
    ]);

    const cells = container.querySelectorAll("tbody td");
    expect(cells.length).toBe(2);
    expect(cells[0].textContent).toBe("5:00 PM");
    expect(cells[1].getAttribute("colspan")).toBe("5");
    expect(cells[1].textContent).toBe("Talkset");
    expect(capsuleLabels(container)).toEqual([]);
  });

  // A breakpoint is logged roughly a minute either side of the hour it marks,
  // so its add_time reads the wrong hour.
  it("times a breakpoint by the hour it marks, not the minute it was logged", () => {
    const { container } = renderEntries([
      entry({
        id: 3,
        entry_type: "breakpoint",
        message: "--- 9:00 PM BREAKPOINT ---",
        add_time: "2026-08-23T00:59:00.000Z",
        radio_hour: "2026-08-23T01:00:00.000Z",
      }),
    ]);

    expect(container.querySelector("tbody td")!.textContent).toBe("9:00 PM");
  });

  it("gives every row the same column width", () => {
    const { container } = renderEntries([
      entry({ id: 1 }),
      entry({ id: 2, entry_type: "show_start", dj_name: "DJ Chowder" }),
      entry({
        id: 3,
        entry_type: "breakpoint",
        message: "--- 3:00 PM BREAKPOINT ---",
      }),
    ]);

    const width = (row: Element) =>
      [...row.children].reduce(
        (n, cell) => n + (Number(cell.getAttribute("colspan")) || 1),
        0
      );

    const header = container.querySelector("thead tr")!;
    for (const row of container.querySelectorAll("tbody tr")) {
      expect(width(row)).toBe(width(header));
    }
  });

  // The whole look of this table — dark header, padded bordered rows, the zebra,
  // the coloured talkset and breakpoint bars — is tubafrenzy's `.entry-table`
  // family, ported into wxyc.css and shared with every other Classic table. None
  // of it is reachable from markup that does not name these classes, so the
  // classes are the contract and are pinned here rather than left to a visual
  // check nobody runs.
  describe("wears tubafrenzy's entry-table classes", () => {
    it("names the table and its header row", () => {
      const { container } = renderEntries([entry({ id: 1 })]);
      expect(container.querySelector("table")).toHaveClass("entry-table");
      expect(container.querySelector("thead tr")).toHaveClass("entry-header");
    });

    it("stripes track rows even/odd", () => {
      const { container } = renderEntries([
        entry({ id: 1 }),
        entry({ id: 2, artist_name: "Stereolab" }),
        entry({ id: 3, artist_name: "Cat Power" }),
      ]);
      expect(rowClasses(container)).toEqual([
        "entry-row entry-row-even",
        "entry-row entry-row-odd",
        "entry-row entry-row-even",
      ]);
    });

    // The JSP stripes on the loop index over every entry, markers included, so a
    // marker shifts the phase of the rows after it. Striping the tracks alone
    // would put the wrong rows on the tint the moment a show has a talkset.
    it("lets a marker take its turn in the zebra", () => {
      const { container } = renderEntries([
        entry({ id: 1 }),
        entry({ id: 2, entry_type: "talkset", message: "TALKSET" }),
        entry({ id: 3, artist_name: "Cat Power" }),
      ]);
      expect(rowClasses(container)).toEqual([
        "entry-row entry-row-even",
        "talkset-row",
        "entry-row entry-row-even",
      ]);
    });

    it.each<[NonNullable<FlowsheetRangeEntryWire["entry_type"]>, string]>([
      ["talkset", "talkset-row"],
      ["breakpoint", "breakpoint-row"],
      ["show_start", "breakpoint-row"],
      ["show_end", "breakpoint-row"],
    ])("gives a %s row the %s class", (entry_type, expected) => {
      const { container } = renderEntries([
        entry({ id: 1, entry_type, message: "MARKER", dj_name: "DJ Chowder" }),
      ]);
      expect(rowClasses(container)).toEqual([expected]);
    });

    it("keeps the highlight alongside the row's own class", () => {
      const { container } = renderEntries([entry({ id: 1 })]);
      const { container: marked } = setup({
        entries: [entry({ id: 1 })],
        highlightedEntryId: 1,
      });
      expect(rowClasses(container)).toEqual(["entry-row entry-row-even"]);
      expect(rowClasses(marked)).toEqual([
        "entry-row entry-row-even playlistEntryHighlight",
      ]);
    });
  });

  it("still reports an empty show rather than rendering a bare table", () => {
    renderEntries([]);
    expect(
      screen.getByText(/No entries recorded for this show/)
    ).toBeInTheDocument();
  });

  it("names the show", () => {
    const { container } = renderEntries([entry({ id: 1 })]);
    expect(within(container).getByRole("heading").textContent).toBe("DJ Chowder");
  });
});
