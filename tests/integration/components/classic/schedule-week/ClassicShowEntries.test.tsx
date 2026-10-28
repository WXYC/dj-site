import { describe, it, expect } from "vitest";
import type { ComponentProps } from "react";
import { screen, within } from "@testing-library/react";
import type { FlowsheetRangeShow } from "@wxyc/shared";
import { createComponentHarness } from "@/tests/helpers";
import { RotationBin } from "@/lib/features/rotation/types";
import type { FlowsheetRangeEntryWire } from "@/lib/features/flowsheet/conversions";
import { entryAnchorId } from "@/lib/features/schedule-week/showUrl";
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

const headerLabels = (container: HTMLElement) =>
  [...container.querySelectorAll("thead th")].map((h) => h.textContent);

// The live flowsheet's columns, with the past show's Time cell and indicator
// gutter after the drag handle. The leading and trailing cells are the drag
// handle and the action menu, unlabeled.
const COLUMNS = [
  "",
  "Time",
  "",
  "Playlist",
  "Req.",
  "Artist",
  "Song",
  "Release",
  "Label",
  "",
];

describe("ClassicShowEntries", () => {
  // Whether the viewer may edit changes on the air — a DJ's view loses the
  // controls the moment the show ends — so the layout must not depend on it.
  // Only the controls differ.
  describe.each([true, false])("with editable %s", (editable) => {
    const renderAs = (
      entries: FlowsheetRangeEntryWire[],
      highlightedEntryId: number | null = null
    ) => setup({ entries, editable, highlightedEntryId });

    it("renders the live flowsheet's columns", () => {
      const { container } = renderAs([entry({ id: 1 })]);
      expect(headerLabels(container)).toEqual(COLUMNS);
    });

    it("renders a playcut across every column", () => {
      const { container } = renderAs([entry({ id: 1, request_flag: true })]);
      const cells = [...container.querySelectorAll("tbody td")];
      expect(cells.map((c) => c.textContent).slice(1, -1)).toEqual([
        "5:00 PM",
        "REQUEST",
        "",
        "*",
        "Juana Molina",
        "la paradoja",
        "DOGA",
        "Sonamos",
      ]);
    });

    it("gives every row the same column width", () => {
      const { container } = renderAs([
        entry({ id: 1 }),
        entry({ id: 2, entry_type: "show_start", dj_name: "DJ Chowder" }),
        entry({ id: 3, entry_type: "talkset", message: "TALKSET" }),
        entry({
          id: 4,
          entry_type: "breakpoint",
          message: "--- 3:00 PM BREAKPOINT ---",
        }),
        entry({
          id: 5,
          entry_type: "spotlight",
          spotlight_role: "performer",
          spotlight_name: "Porch Static",
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

    it("keeps a marker row's time cell", () => {
      const { container } = renderAs([
        entry({ id: 2, entry_type: "talkset", message: "TALKSET" }),
      ]);
      const time = container.querySelector("tbody .classic-schedule-week-time");
      expect(time!.textContent).toBe("5:00 PM");
      expect(capsuleLabels(container)).toEqual([]);
    });

    // A breakpoint is logged roughly a minute either side of the hour it
    // marks, so its add_time reads the wrong hour.
    it("times a breakpoint by the hour it marks, not the minute it was logged", () => {
      const { container } = renderAs([
        entry({
          id: 3,
          entry_type: "breakpoint",
          message: "--- 9:00 PM BREAKPOINT ---",
          add_time: "2026-08-23T00:59:00.000Z",
          radio_hour: "2026-08-23T01:00:00.000Z",
        }),
      ]);
      expect(
        container.querySelector("tbody .classic-schedule-week-time")!.textContent
      ).toBe("9:00 PM");
    });

    it.each<[NonNullable<FlowsheetRangeEntryWire["entry_type"]>, string]>([
      ["track", "entry-row"],
      ["talkset", "talkset-row"],
      ["breakpoint", "breakpoint-row"],
      ["show_start", "breakpoint-row"],
      ["show_end", "breakpoint-row"],
      ["spotlight", "spotlight-row"],
    ])("gives a %s row the live flowsheet's %s class", (entry_type, expected) => {
      const { container } = renderAs([
        entry({
          id: 1,
          entry_type,
          message: "MARKER",
          dj_name: "DJ Chowder",
          spotlight_role: "performer",
          spotlight_name: "Porch Static",
        }),
      ]);
      expect(container.querySelector("tbody tr")).toHaveClass(
        "flowsheetEntryData",
        expected
      );
    });

    it("marks and anchors the row an archive link named", () => {
      const { container } = renderAs(
        [entry({ id: 1 }), entry({ id: 2, artist_name: "Stereolab" })],
        2
      );
      const marked = container.querySelectorAll("tbody tr.playlistEntryHighlight");
      expect(marked).toHaveLength(1);
      expect(marked[0].id).toBe(entryAnchorId(2));
      expect(container.querySelectorAll("tbody tr[id]")).toHaveLength(1);
    });

    it("names the table and its header row with tubafrenzy's classes", () => {
      const { container } = renderAs([entry({ id: 1 })]);
      expect(container.querySelector("table")).toHaveClass("entry-table");
      expect(container.querySelector("thead tr")).toHaveClass("entry-header");
    });

    it("offers controls only when editable", () => {
      const { container } = renderAs([
        entry({ id: 1 }),
        entry({ id: 2, entry_type: "talkset", message: "TALKSET" }),
        entry({
          id: 3,
          entry_type: "spotlight",
          spotlight_role: "performer",
          spotlight_name: "Porch Static",
        }),
      ]);
      expect(screen.queryAllByLabelText("Drag to reorder").length > 0).toBe(editable);
      expect(screen.queryAllByLabelText("Actions").length > 0).toBe(editable);
      expect(container.querySelectorAll('tr[draggable="true"]').length > 0).toBe(
        editable
      );
      if (!editable) {
        expect(container.querySelectorAll("button, input")).toHaveLength(0);
      }
    });
  });

  it("renders the same markup either way but for the controls", () => {
    const entries = [
      entry({ id: 1 }),
      entry({ id: 2, entry_type: "talkset", message: "TALKSET" }),
      entry({ id: 3, entry_type: "show_end", dj_name: "DJ Chowder" }),
    ];
    const shape = (container: HTMLElement) =>
      [...container.querySelectorAll("tbody tr")].map((row) => ({
        className: row.className,
        cells: [...row.children].map((cell) => ({
          className: cell.className,
          colSpan: cell.getAttribute("colspan"),
          text: cell.classList.contains("action-cell") ||
            cell.classList.contains("grip-cell")
            ? null
            : cell.textContent,
        })),
      }));

    const { container: editing, unmount } = setup({ entries, editable: true });
    const withControls = shape(editing);
    unmount();
    const { container: reading } = setup({ entries, editable: false });

    expect(shape(reading)).toEqual(withControls);
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

  it("words a who's-on row in the client's wording, centered", () => {
    const { container } = renderEntries([
      entry({
        id: 1,
        entry_type: "spotlight",
        spotlight_role: "performer",
        spotlight_name: "Porch Static",
        message: "Spotlight: Porch Static",
      }),
    ]);
    const cell = container.querySelector("tbody tr.spotlight-row td[colspan]");
    expect(cell).toHaveAttribute("align", "center");
    expect(cell!.textContent).toBe("Porch Static live in the studio");
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
