import { describe, it, expect, vi } from "vitest";
import { fireEvent } from "@testing-library/react";
import {
  createTestFlowsheetEntry,
  renderWithProviders,
  stubIntersectionObserver,
} from "@/tests/helpers";
import type { FlowsheetEntry } from "@/lib/features/flowsheet/types";
import EntryTable from "@/src/components/experiences/classic/flowsheet/EntryTable";

const { triggerSentinel } = stubIntersectionObserver();

type SetupOptions = {
  entries?: FlowsheetEntry[];
  previousEntries?: FlowsheetEntry[];
  onReorder?: (sourceId: number, targetId: number) => void;
  hasNextPage?: boolean;
  isLoadingMore?: boolean;
  isFetching?: boolean;
  onLoadMore?: () => void;
};

const defaultEntries = (): FlowsheetEntry[] => [
  createTestFlowsheetEntry({
    id: 101,
    play_order: 1,
    artist_name: "Juana Molina",
    track_title: "la paradoja",
  }),
  createTestFlowsheetEntry({
    id: 102,
    play_order: 2,
    artist_name: "Jessica Pratt",
    track_title: "Back, Baby",
  }),
  createTestFlowsheetEntry({
    id: 103,
    play_order: 3,
    artist_name: "Chuquimamani-Condori",
    track_title: "Call Your Name",
  }),
];

function setup(opts?: SetupOptions) {
  const entries = opts?.entries ?? defaultEntries();
  const onReorder = opts?.onReorder ?? vi.fn();
  const onLoadMore = opts?.onLoadMore ?? vi.fn();

  const element = (overrides?: SetupOptions) => (
    <EntryTable
      entries={overrides?.entries ?? entries}
      previousEntries={
        overrides?.previousEntries ?? opts?.previousEntries ?? []
      }
      onUpdate={() => {}}
      onDelete={() => {}}
      onReorder={onReorder}
      hasNextPage={overrides?.hasNextPage ?? opts?.hasNextPage ?? false}
      isLoadingMore={overrides?.isLoadingMore ?? opts?.isLoadingMore ?? false}
      isFetching={overrides?.isFetching ?? opts?.isFetching ?? false}
      onLoadMore={onLoadMore}
    />
  );

  const utils = renderWithProviders(element());
  return {
    ...utils,
    onReorder,
    entries,
    onLoadMore,
    /** Re-renders with the same defaults, changing only `overrides`. */
    rerenderWith: (overrides: SetupOptions) => utils.rerender(element(overrides)),
  };
}

describe("Classic EntryTable header", () => {
  it("does NOT include 'Move Up' or 'Move Down' headers", () => {
    const { container } = setup();
    const headers = Array.from(container.querySelectorAll("thead th")).map(
      (th) => th.textContent ?? ""
    );
    for (const h of headers) {
      expect(h).not.toMatch(/move up/i);
      expect(h).not.toMatch(/move down/i);
      expect(h).not.toMatch(/or down/i);
    }
  });

  it("has 8 columns: grip + playlist + req + artist + song + release + label + action", () => {
    const { container } = setup();
    const headers = container.querySelectorAll("thead th");
    expect(headers.length).toBe(8);
  });

  it("labels the Playlist and Req. indicator columns like tubafrenzy", () => {
    const { container } = setup();
    const headers = Array.from(container.querySelectorAll("thead th")).map(
      (th) => th.textContent ?? ""
    );
    expect(headers[1]).toBe("Playlist");
    expect(headers[2]).toBe("Req.");
  });

  it("places an empty grip-handle column as the first header cell", () => {
    const { container } = setup();
    const firstTh = container.querySelector("thead th:first-child");
    expect(firstTh!.textContent).toBe("");
  });

  it("renders an empty trailing column header (no 'Edit/Delete' label)", () => {
    const { container } = setup();
    const headers = Array.from(container.querySelectorAll("thead th"));
    const lastTh = headers[headers.length - 1];
    expect(lastTh.textContent).toBe("");
  });
});

describe("Classic EntryTable drag-to-reorder", () => {
  it("calls onReorder(sourceId, targetId) when one song row is dropped onto another", () => {
    const { container, onReorder } = setup();
    const rows = container.querySelectorAll("tbody tr.flowsheetEntryData");
    const sourceRow = rows[0] as HTMLElement;
    const targetRow = rows[2] as HTMLElement;

    fireEvent.dragStart(sourceRow);
    fireEvent.dragOver(targetRow);
    fireEvent.drop(targetRow);

    expect(onReorder).toHaveBeenCalledTimes(1);
    expect(onReorder).toHaveBeenCalledWith(101, 103);
  });

  it("does NOT call onReorder when a row is dropped onto itself", () => {
    const { container, onReorder } = setup();
    const row = container.querySelector(
      "tbody tr.flowsheetEntryData"
    ) as HTMLElement;

    fireEvent.dragStart(row);
    fireEvent.dragOver(row);
    fireEvent.drop(row);

    expect(onReorder).not.toHaveBeenCalled();
  });

  it("does NOT call onReorder when drop fires without a preceding dragStart", () => {
    const { container, onReorder } = setup();
    const rows = container.querySelectorAll("tbody tr.flowsheetEntryData");
    const targetRow = rows[1] as HTMLElement;

    fireEvent.dragOver(targetRow);
    fireEvent.drop(targetRow);

    expect(onReorder).not.toHaveBeenCalled();
  });

  it("clears the drag source on dragEnd so a subsequent drop does nothing", () => {
    const { container, onReorder } = setup();
    const rows = container.querySelectorAll("tbody tr.flowsheetEntryData");
    const sourceRow = rows[0] as HTMLElement;
    const targetRow = rows[2] as HTMLElement;

    fireEvent.dragStart(sourceRow);
    fireEvent.dragEnd(sourceRow);
    fireEvent.drop(targetRow);

    expect(onReorder).not.toHaveBeenCalled();
  });

  it("applies the .dragging class to the source row during a drag", () => {
    const { container } = setup();
    const sourceRow = container.querySelector(
      "tbody tr.flowsheetEntryData"
    ) as HTMLElement;

    fireEvent.dragStart(sourceRow);
    expect(sourceRow.classList.contains("dragging")).toBe(true);

    fireEvent.dragEnd(sourceRow);
    expect(sourceRow.classList.contains("dragging")).toBe(false);
  });

  it("does NOT initiate a drag from a breakpoint row (not draggable)", () => {
    const breakpoint: FlowsheetEntry = {
      id: 200,
      show_id: 1,
      play_order: 1,
      message: "Breakpoint - 5:00 PM",
      day: "11/14/2023",
      time: "5:00:00 PM",
    };
    const { container, onReorder } = setup({
      entries: [
        breakpoint,
        createTestFlowsheetEntry({ id: 201, play_order: 2 }),
      ],
    });
    const rows = container.querySelectorAll("tbody tr.flowsheetEntryData");
    const breakpointRow = rows[0] as HTMLElement;
    const songRow = rows[1] as HTMLElement;

    fireEvent.dragStart(breakpointRow);
    fireEvent.dragOver(songRow);
    fireEvent.drop(songRow);

    expect(onReorder).not.toHaveBeenCalled();
  });
});

const previousShowEntry = createTestFlowsheetEntry({
  id: 90,
  play_order: 1,
  track_title: "Last Show's Song",
});

const startShowMarker: FlowsheetEntry = {
  id: 100,
  play_order: 0,
  show_id: 1,
  day: "2026-09-15",
  time: "22:00",
  dj_name: "DJ Aubrey Hearst",
  isStart: true,
};

describe("Classic EntryTable pagination", () => {
  it("calls onLoadMore when the sentinel intersects and a next page exists", () => {
    const { onLoadMore } = setup({ hasNextPage: true });

    triggerSentinel();

    expect(onLoadMore).toHaveBeenCalledTimes(1);
  });

  // The feed runs back through every show ever logged, so hasNextPage stays
  // true long after this show's first row is on screen — and older rows land in
  // the collapsed previous-show section, which does not grow the rendered
  // height, so an unbounded sentinel stays in view and walks the archive.
  it.each<[string, SetupOptions]>([
    ["there is no next page", { hasNextPage: false }],
    ["a page is already loading", { hasNextPage: true, isLoadingMore: true }],
    ["a background poll is in flight", { hasNextPage: true, isFetching: true }],
    [
      "the show's start marker is already loaded",
      { hasNextPage: true, entries: [startShowMarker] },
    ],
    [
      "entries older than the current show have loaded",
      { hasNextPage: true, previousEntries: [previousShowEntry] },
    ],
  ])("does NOT page when %s", (_label, opts) => {
    const { onLoadMore } = setup(opts);

    triggerSentinel();

    expect(onLoadMore).not.toHaveBeenCalled();
  });

  it("resumes paging once the poll that suppressed it settles", () => {
    const { onLoadMore, rerenderWith } = setup({
      hasNextPage: true,
      isFetching: true,
    });

    triggerSentinel();
    expect(onLoadMore).not.toHaveBeenCalled();

    rerenderWith({ isFetching: false });
    triggerSentinel();

    expect(onLoadMore).toHaveBeenCalledTimes(1);
  });

  // A page merge must not renumber the row array under an in-flight drag.
  it("does NOT page while a row is mid-drag, and resumes when the drag ends", () => {
    const { container, onLoadMore } = setup({ hasNextPage: true });
    const sourceRow = container.querySelector(
      "tbody tr.flowsheetEntryData"
    ) as HTMLElement;

    fireEvent.dragStart(sourceRow);
    triggerSentinel();
    expect(onLoadMore).not.toHaveBeenCalled();

    fireEvent.dragEnd(sourceRow);
    triggerSentinel();

    expect(onLoadMore).toHaveBeenCalledTimes(1);
  });

  it.each<[SetupOptions, boolean]>([
    [{ hasNextPage: true, isLoadingMore: true }, true],
    [{ hasNextPage: true, isFetching: true }, false],
    [{ hasNextPage: false, isLoadingMore: false }, false],
  ])("renders the loading copy only for a page fetch (%o)", (opts, shown) => {
    const { queryByText } = setup(opts);

    const copy = queryByText(/loading more entries/i);
    if (shown) {
      expect(copy).toBeInTheDocument();
    } else {
      expect(copy).not.toBeInTheDocument();
    }
  });

  it("keeps the previous-show toggle working with pagination wired in", () => {
    const { getByText, queryByText } = setup({
      hasNextPage: true,
      previousEntries: [previousShowEntry],
    });

    expect(queryByText("Last Show's Song")).not.toBeInTheDocument();

    fireEvent.click(getByText("Show the flowsheet from the previous show"));

    expect(getByText("Last Show's Song")).toBeInTheDocument();
  });
});
