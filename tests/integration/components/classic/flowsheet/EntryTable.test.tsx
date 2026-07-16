import { describe, it, expect, vi } from "vitest";
import { fireEvent } from "@testing-library/react";
import { renderWithProviders } from "@/tests/helpers/render";
import { createTestFlowsheetEntry } from "@/tests/helpers";
import type { FlowsheetEntry } from "@/lib/features/flowsheet/types";
import EntryTable from "@/src/components/experiences/classic/flowsheet/EntryTable";

function setup(opts?: { entries?: FlowsheetEntry[]; onReorder?: (sourceId: number, targetId: number) => void }) {
  const entries: FlowsheetEntry[] =
    opts?.entries ??
    [
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
  const onReorder = opts?.onReorder ?? vi.fn();
  const utils = renderWithProviders(
    <EntryTable
      entries={entries}
      previousEntries={[]}
      fontSize={3}
      onUpdate={() => {}}
      onDelete={() => {}}
      onReorder={onReorder}
    />
  );
  return { ...utils, onReorder, entries };
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

  it("has 7 columns: grip + indicators + artist + song + release + label + edit", () => {
    const { container } = setup();
    const headers = container.querySelectorAll("thead th");
    expect(headers.length).toBe(7);
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
