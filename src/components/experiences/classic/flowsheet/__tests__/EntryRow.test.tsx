import { describe, it, expect, vi } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import { renderWithProviders } from "@/tests/helpers/render";
import { createTestFlowsheetEntry } from "@/tests/helpers";
import { Rotation } from "@/lib/features/rotation/types";
import type {
  FlowsheetEntry,
  UpdateRequestBody,
} from "@/lib/features/flowsheet/types";
import EntryRow from "../EntryRow";

// renderInTable wraps EntryRow in a <table><tbody> so the row's <td> elements
// are mounted in a valid layout context (RTL otherwise warns).
// renderRow defaults `onDragStart` to a no-op so the "live" rendering context
// (where the parent always wires drag handlers) is the default. Tests that
// want the read-only previous-show context can pass `dragHandlers: false`.
function renderRow(props: {
  entry: FlowsheetEntry;
  nextIsSong?: boolean;
  isDragging?: boolean;
  isDragOver?: boolean;
  dragHandlers?: boolean;
  onUpdate?: (entryId: number, data: UpdateRequestBody) => void;
  onDelete?: (entryId: number) => void;
  onDragStart?: (entryId: number) => void;
  onDragOver?: (entryId: number) => void;
  onDrop?: (entryId: number) => void;
  onDragEnd?: () => void;
}) {
  const dragHandlersEnabled = props.dragHandlers !== false;
  return renderWithProviders(
    <table>
      <tbody>
        <EntryRow
          entry={props.entry}
          fontSize={3}
          onUpdate={props.onUpdate ?? (() => {})}
          onDelete={props.onDelete ?? (() => {})}
          nextIsSong={props.nextIsSong}
          isDragging={props.isDragging}
          isDragOver={props.isDragOver}
          onDragStart={
            dragHandlersEnabled ? props.onDragStart ?? (() => {}) : undefined
          }
          onDragOver={props.onDragOver}
          onDrop={props.onDrop}
          onDragEnd={props.onDragEnd}
        />
      </tbody>
    </table>
  );
}

describe("Classic EntryRow capsule indicators", () => {
  it("renders a REQUEST capsule when request_flag=true", () => {
    const entry = createTestFlowsheetEntry({ request_flag: true });
    renderRow({ entry });
    expect(screen.getByText("REQUEST")).toBeDefined();
  });

  it("does not render any capsule when no flags are set", () => {
    const entry = createTestFlowsheetEntry({
      request_flag: false,
      rotation: undefined,
      on_streaming: undefined,
    });
    renderRow({ entry });
    expect(screen.queryByText("REQUEST")).toBeNull();
    expect(screen.queryByText(/^ROTATION /)).toBeNull();
    expect(screen.queryByText("EXCLUSIVE")).toBeNull();
  });

  it.each([
    [Rotation.H, "ROTATION H"],
    [Rotation.M, "ROTATION M"],
    [Rotation.L, "ROTATION L"],
    [Rotation.S, "ROTATION S"],
  ])("renders a %s rotation capsule as %s", (rotation, label) => {
    const entry = createTestFlowsheetEntry({ rotation });
    renderRow({ entry });
    expect(screen.getByText(label)).toBeDefined();
  });

  it("renders an EXCLUSIVE capsule when on_streaming=false", () => {
    const entry = createTestFlowsheetEntry({ on_streaming: false });
    renderRow({ entry });
    expect(screen.getByText("EXCLUSIVE")).toBeDefined();
  });

  it("does not render EXCLUSIVE when on_streaming=true", () => {
    const entry = createTestFlowsheetEntry({ on_streaming: true });
    renderRow({ entry });
    expect(screen.queryByText("EXCLUSIVE")).toBeNull();
  });

  it("renders REQUEST, ROTATION, and EXCLUSIVE together in that priority order", () => {
    const entry = createTestFlowsheetEntry({
      request_flag: true,
      rotation: Rotation.H,
      on_streaming: false,
    });
    renderRow({ entry });
    const request = screen.getByText("REQUEST");
    const rotation = screen.getByText("ROTATION H");
    const exclusive = screen.getByText("EXCLUSIVE");
    // DOM order matches priority order.
    const order = [request, rotation, exclusive].map((el) =>
      Array.from(document.body.querySelectorAll(".classic-capsule")).indexOf(el)
    );
    expect(order).toEqual([0, 1, 2]);
  });

  it("renders the indicators inside the second <td> cell (after the grip handle)", () => {
    const entry = createTestFlowsheetEntry({ request_flag: true });
    const { container } = renderRow({ entry });
    const indicatorsCell = container.querySelector("tr > td:nth-child(2)");
    expect(indicatorsCell).not.toBeNull();
    expect(indicatorsCell!.querySelector(".classic-capsule")).not.toBeNull();
  });
});

describe("Classic EntryRow grip handle (drag-to-reorder)", () => {
  it("renders a grip handle on song rows with aria-label", () => {
    const entry = createTestFlowsheetEntry();
    const { container } = renderRow({ entry });
    const handle = container.querySelector(".grip-handle");
    expect(handle).not.toBeNull();
    expect(handle!.getAttribute("aria-label")).toBe("Drag to reorder");
  });

  it("places the grip handle inside the first <td> cell", () => {
    const entry = createTestFlowsheetEntry();
    const { container } = renderRow({ entry });
    const firstCell = container.querySelector("tr > td:first-child");
    expect(firstCell).not.toBeNull();
    expect(firstCell!.classList.contains("grip-cell")).toBe(true);
    expect(firstCell!.querySelector(".grip-handle")).not.toBeNull();
  });

  it("marks song rows as draggable", () => {
    const entry = createTestFlowsheetEntry();
    const { container } = renderRow({ entry });
    const row = container.querySelector("tr.flowsheetEntryData");
    expect(row!.getAttribute("draggable")).toBe("true");
  });

  it("renders a grip handle on talkset rows and marks them draggable", () => {
    const entry: FlowsheetEntry = {
      id: 10,
      show_id: 1,
      play_order: 1,
      message: "Talkset - station ID",
    };
    const { container } = renderRow({ entry });
    expect(container.querySelector(".grip-handle")).not.toBeNull();
    const row = container.querySelector("tr.classic-marker-talkset");
    expect(row!.getAttribute("draggable")).toBe("true");
  });

  it("does NOT render a grip handle on breakpoint rows and they are not draggable", () => {
    const entry: FlowsheetEntry = {
      id: 11,
      show_id: 1,
      play_order: 2,
      message: "Breakpoint - 5:00 PM",
      day: "11/14/2023",
      time: "5:00:00 PM",
    };
    const { container } = renderRow({ entry });
    expect(container.querySelector(".grip-handle")).toBeNull();
    const row = container.querySelector("tr.classic-marker-breakpoint");
    expect(row!.getAttribute("draggable")).not.toBe("true");
  });

  it("does NOT render a grip handle on start-of-show rows", () => {
    const entry: FlowsheetEntry = {
      id: 12,
      show_id: 1,
      play_order: 0,
      dj_name: "DJ Cool",
      isStart: true,
      day: "11/14/2023",
      time: "5:00:00 PM",
    };
    const { container } = renderRow({ entry });
    expect(container.querySelector(".grip-handle")).toBeNull();
    const row = container.querySelector("tr.classic-marker-breakpoint");
    expect(row!.getAttribute("draggable")).not.toBe("true");
  });

  it("does NOT render a grip handle on end-of-show rows", () => {
    const entry: FlowsheetEntry = {
      id: 13,
      show_id: 1,
      play_order: 99,
      dj_name: "DJ Cool",
      isStart: false,
      day: "11/14/2023",
      time: "5:00:00 PM",
    };
    const { container } = renderRow({ entry });
    expect(container.querySelector(".grip-handle")).toBeNull();
  });

  it("does NOT render the legacy move up arrow on song rows", () => {
    const entry = createTestFlowsheetEntry();
    const { container } = renderRow({ entry });
    expect(container.querySelector('img[src*="blue_up.gif"]')).toBeNull();
  });

  it("does NOT render the legacy move down arrow on song rows", () => {
    const entry = createTestFlowsheetEntry();
    const { container } = renderRow({ entry });
    expect(container.querySelector('img[src*="blue_down.gif"]')).toBeNull();
  });
});

describe("Classic EntryRow read-only context (no drag handlers wired)", () => {
  it("does NOT mark a song row draggable when onDragStart is undefined", () => {
    const entry = createTestFlowsheetEntry();
    const { container } = renderRow({ entry, dragHandlers: false });
    const row = container.querySelector("tr.flowsheetEntryData");
    expect(row!.getAttribute("draggable")).not.toBe("true");
  });

  it("renders an empty grip cell (not the grip handle) on a song row when onDragStart is undefined", () => {
    const entry = createTestFlowsheetEntry();
    const { container } = renderRow({ entry, dragHandlers: false });
    const firstCell = container.querySelector("tr > td:first-child");
    expect(firstCell).not.toBeNull();
    expect(firstCell!.classList.contains("grip-cell")).toBe(true);
    expect(firstCell!.querySelector(".grip-handle")).toBeNull();
  });

  it("does NOT mark a talkset row draggable when onDragStart is undefined", () => {
    const entry: FlowsheetEntry = {
      id: 20,
      show_id: 1,
      play_order: 1,
      message: "Talkset - station ID",
    };
    const { container } = renderRow({ entry, dragHandlers: false });
    const row = container.querySelector("tr.classic-marker-talkset");
    expect(row!.getAttribute("draggable")).not.toBe("true");
    expect(container.querySelector(".grip-handle")).toBeNull();
  });
});

describe("Classic EntryRow segue indicator", () => {
  it("renders the .classic-segue class on a segue song row when the next row is also a song", () => {
    const entry = createTestFlowsheetEntry({ segue: true });
    const { container } = renderRow({ entry, nextIsSong: true });
    const row = container.querySelector("tr.classic-segue");
    expect(row).not.toBeNull();
    // The row also exposes data-segue="true" so CSS can target it.
    expect(row!.getAttribute("data-segue")).toBe("true");
  });

  it("does NOT render the segue indicator when the next row is not a song row", () => {
    const entry = createTestFlowsheetEntry({ segue: true });
    const { container } = renderRow({ entry, nextIsSong: false });
    const row = container.querySelector("tr.classic-segue");
    expect(row).toBeNull();
  });

  it("does NOT render the segue indicator when segue is false", () => {
    const entry = createTestFlowsheetEntry({ segue: false });
    const { container } = renderRow({ entry, nextIsSong: true });
    expect(container.querySelector("tr.classic-segue")).toBeNull();
  });

  it("does NOT render the segue indicator when segue is undefined", () => {
    const entry = createTestFlowsheetEntry({ segue: undefined });
    const { container } = renderRow({ entry, nextIsSong: true });
    expect(container.querySelector("tr.classic-segue")).toBeNull();
  });
});

describe("Classic EntryRow markers", () => {
  describe("talkset", () => {
    const talksetEntry = {
      id: 1,
      show_id: 1,
      play_order: 1,
      message: "Talkset - station ID",
    };

    it("renders the lowercase word 'talkset' centered (in the second cell after grip)", () => {
      const { container } = renderRow({ entry: talksetEntry });
      const cell = container.querySelector("tr > td:nth-child(2)");
      expect(cell).not.toBeNull();
      expect(cell!.textContent).toBe("talkset");
      expect(cell!.getAttribute("align")).toBe("center");
    });

    it("uses the classic-marker-talkset class on its row (background #BBBBBB)", () => {
      const { container } = renderRow({ entry: talksetEntry });
      const row = container.querySelector("tr");
      expect(row).not.toBeNull();
      expect(row!.classList.contains("classic-marker-talkset")).toBe(true);
    });

    it("does NOT use the legacy redlabel class on its cell", () => {
      const { container } = renderRow({ entry: talksetEntry });
      expect(container.querySelector(".redlabel")).toBeNull();
    });
  });

  describe("breakpoint", () => {
    const breakpointEntry = {
      id: 2,
      show_id: 1,
      play_order: 2,
      message: "Breakpoint - 5:00 PM",
      day: "11/14/2023",
      time: "5:00:00 PM",
    };

    it("renders '{h:mm a} breakpoint' (no seconds, lowercase suffix)", () => {
      const { container } = renderRow({ entry: breakpointEntry });
      const cell = container.querySelector("tr > td:nth-child(2)");
      expect(cell).not.toBeNull();
      expect(cell!.textContent).toBe("5:00 PM breakpoint");
    });

    it("renders content centered", () => {
      const { container } = renderRow({ entry: breakpointEntry });
      const cell = container.querySelector("tr > td:nth-child(2)");
      expect(cell!.getAttribute("align")).toBe("center");
    });

    it("uses the classic-marker-breakpoint class on its row", () => {
      const { container } = renderRow({ entry: breakpointEntry });
      const row = container.querySelector("tr");
      expect(row!.classList.contains("classic-marker-breakpoint")).toBe(true);
    });

    it("does NOT use the legacy littlegreenlabel class on its cell", () => {
      const { container } = renderRow({ entry: breakpointEntry });
      expect(container.querySelector(".littlegreenlabel")).toBeNull();
    });
  });

  describe("start of show", () => {
    const startEntry = {
      id: 3,
      show_id: 1,
      play_order: 3,
      dj_name: "DJ Cool",
      isStart: true,
      day: "11/14/2023",
      time: "5:13:00 PM",
    };

    it("renders 'Start of show — {dj_name} @ {M/d/yy} {h:mm a}'", () => {
      const { container } = renderRow({ entry: startEntry });
      const cell = container.querySelector("tr > td:nth-child(2)");
      expect(cell!.textContent).toBe(
        "Start of show — DJ Cool @ 11/14/23 5:13 PM"
      );
    });

    it("uses the classic-marker-breakpoint class on its row (shared #444 styling)", () => {
      const { container } = renderRow({ entry: startEntry });
      const row = container.querySelector("tr");
      expect(row!.classList.contains("classic-marker-breakpoint")).toBe(true);
    });
  });

  describe("end of show", () => {
    const endEntry = {
      id: 4,
      show_id: 1,
      play_order: 4,
      dj_name: "DJ Cool",
      isStart: false,
      day: "11/14/2023",
      time: "5:13:00 PM",
    };

    it("renders 'End of show — {dj_name} @ {M/d/yy} {h:mm a}'", () => {
      const { container } = renderRow({ entry: endEntry });
      const cell = container.querySelector("tr > td:nth-child(2)");
      expect(cell!.textContent).toBe(
        "End of show — DJ Cool @ 11/14/23 5:13 PM"
      );
    });

    it("uses the classic-marker-breakpoint class on its row (shared #444 styling)", () => {
      const { container } = renderRow({ entry: endEntry });
      const row = container.querySelector("tr");
      expect(row!.classList.contains("classic-marker-breakpoint")).toBe(true);
    });
  });

  it.each([
    ["11/14/2023", "5:13:00 PM", "11/14/23 5:13 PM"],
    ["1/3/2024", "12:05:00 AM", "1/3/24 12:05 AM"],
    ["12/31/2099", "11:59:59 PM", "12/31/99 11:59 PM"],
  ])(
    "formats day=%s + time=%s as '%s' in show-block markers",
    (day, time, expected) => {
      const { container } = renderRow({
        entry: {
          id: 5,
          show_id: 1,
          play_order: 5,
          dj_name: "DJ Test",
          isStart: true,
          day,
          time,
        },
      });
      const cell = container.querySelector("tr > td:nth-child(2)");
      expect(cell!.textContent).toBe(`Start of show — DJ Test @ ${expected}`);
    }
  );

  it("falls back to the raw day/time strings when they don't match the expected pattern", () => {
    const { container } = renderRow({
      entry: {
        id: 6,
        show_id: 1,
        play_order: 6,
        dj_name: "DJ Test",
        isStart: true,
        day: "Unknown",
        time: "Unknown",
      },
    });
    const cell = container.querySelector("tr > td:nth-child(2)");
    expect(cell!.textContent).toBe(
      "Start of show — DJ Test @ Unknown Unknown"
    );
  });
});

describe("Classic EntryRow action menu + inline edit (song rows)", () => {
  const baseEntry = () =>
    createTestFlowsheetEntry({
      id: 99,
      artist_name: "Juana Molina",
      track_title: "la paradoja",
      album_title: "DOGA",
      record_label: "Sonamos",
      request_flag: false,
    });

  it("renders an action-menu trigger (⋯) on a song row instead of legacy Edit/Delete links", () => {
    const { container } = renderRow({ entry: baseEntry() });
    const trigger = screen.getByRole("button", { name: /actions/i });
    expect(trigger.textContent).toBe("⋯");
    // No standalone <a>Edit</a> or <a>Delete</a> on the row — those are gone.
    // Edit and Delete now live inside the dropdown menu (.action-dropdown).
    const standaloneEditLink = Array.from(container.querySelectorAll("a")).find(
      (a) => a.textContent === "Edit" && !a.classList.contains("action-item")
    );
    const standaloneDeleteLink = Array.from(
      container.querySelectorAll("a")
    ).find(
      (a) => a.textContent === "Delete" && !a.classList.contains("action-item")
    );
    expect(standaloneEditLink).toBeUndefined();
    expect(standaloneDeleteLink).toBeUndefined();
    // The menu starts closed.
    expect(container.querySelector(".action-menu.open")).toBeNull();
  });

  it("opens the dropdown on trigger click and shows Edit + Delete items", () => {
    renderRow({ entry: baseEntry() });
    fireEvent.click(screen.getByRole("button", { name: /actions/i }));
    expect(screen.getByText("Edit")).toBeDefined();
    expect(screen.getByText("Delete")).toBeDefined();
  });

  it("transitions cells to inputs when Edit is clicked", () => {
    const { container } = renderRow({ entry: baseEntry() });
    fireEvent.click(screen.getByRole("button", { name: /actions/i }));
    fireEvent.click(screen.getByText("Edit"));

    const artist = container.querySelector(
      'input[name="artist_name"]'
    ) as HTMLInputElement | null;
    const track = container.querySelector(
      'input[name="track_title"]'
    ) as HTMLInputElement | null;
    const album = container.querySelector(
      'input[name="album_title"]'
    ) as HTMLInputElement | null;
    const label = container.querySelector(
      'input[name="record_label"]'
    ) as HTMLInputElement | null;
    expect(artist?.value).toBe("Juana Molina");
    expect(track?.value).toBe("la paradoja");
    expect(album?.value).toBe("DOGA");
    expect(label?.value).toBe("Sonamos");
  });

  it("shows a request checkbox in edit mode, pre-checked when request_flag is true", () => {
    const { container } = renderRow({
      entry: createTestFlowsheetEntry({ request_flag: true }),
    });
    fireEvent.click(screen.getByRole("button", { name: /actions/i }));
    fireEvent.click(screen.getByText("Edit"));
    const checkbox = container.querySelector(
      'input[type="checkbox"][name="request_flag"]'
    ) as HTMLInputElement | null;
    expect(checkbox).not.toBeNull();
    expect(checkbox!.checked).toBe(true);
  });

  it("shows an unchecked request checkbox when request_flag is false", () => {
    const { container } = renderRow({ entry: baseEntry() });
    fireEvent.click(screen.getByRole("button", { name: /actions/i }));
    fireEvent.click(screen.getByText("Edit"));
    const checkbox = container.querySelector(
      'input[type="checkbox"][name="request_flag"]'
    ) as HTMLInputElement | null;
    expect(checkbox!.checked).toBe(false);
  });

  it("disables drag on the row while editing", () => {
    const { container } = renderRow({ entry: baseEntry() });
    expect(
      container.querySelector("tr.flowsheetEntryData")!.getAttribute("draggable")
    ).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: /actions/i }));
    fireEvent.click(screen.getByText("Edit"));
    expect(
      container.querySelector("tr.flowsheetEntryData")!.getAttribute("draggable")
    ).toBe("false");
  });

  it("fires onUpdate with the edited values on Save", () => {
    const onUpdate = vi.fn();
    const { container } = renderRow({ entry: baseEntry(), onUpdate });
    fireEvent.click(screen.getByRole("button", { name: /actions/i }));
    fireEvent.click(screen.getByText("Edit"));

    const artist = container.querySelector(
      'input[name="artist_name"]'
    ) as HTMLInputElement;
    const track = container.querySelector(
      'input[name="track_title"]'
    ) as HTMLInputElement;
    const requestCheckbox = container.querySelector(
      'input[type="checkbox"][name="request_flag"]'
    ) as HTMLInputElement;

    fireEvent.change(artist, { target: { value: "Juana M." } });
    fireEvent.change(track, { target: { value: "la paradoja (live)" } });
    fireEvent.click(requestCheckbox);

    fireEvent.click(screen.getByRole("button", { name: /save/i }));

    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(onUpdate).toHaveBeenCalledWith(99, {
      artist_name: "Juana M.",
      track_title: "la paradoja (live)",
      album_title: "DOGA",
      record_label: "Sonamos",
      request_flag: true,
    });
  });

  it("exits edit mode after Save", () => {
    const { container } = renderRow({ entry: baseEntry() });
    fireEvent.click(screen.getByRole("button", { name: /actions/i }));
    fireEvent.click(screen.getByText("Edit"));
    fireEvent.click(screen.getByRole("button", { name: /save/i }));
    expect(container.querySelector('input[name="artist_name"]')).toBeNull();
    expect(screen.getByRole("button", { name: /actions/i })).toBeDefined();
  });

  it("does NOT fire onUpdate when Save is clicked with an empty track_title", () => {
    const onUpdate = vi.fn();
    const { container } = renderRow({ entry: baseEntry(), onUpdate });
    fireEvent.click(screen.getByRole("button", { name: /actions/i }));
    fireEvent.click(screen.getByText("Edit"));

    const track = container.querySelector(
      'input[name="track_title"]'
    ) as HTMLInputElement;
    fireEvent.change(track, { target: { value: "   " } });

    fireEvent.click(screen.getByRole("button", { name: /save/i }));
    expect(onUpdate).not.toHaveBeenCalled();
    // Row remains in edit mode so the user can fix it.
    expect(container.querySelector('input[name="track_title"]')).not.toBeNull();
  });

  it("restores original values and exits edit mode on Cancel", () => {
    const onUpdate = vi.fn();
    const { container } = renderRow({ entry: baseEntry(), onUpdate });
    fireEvent.click(screen.getByRole("button", { name: /actions/i }));
    fireEvent.click(screen.getByText("Edit"));

    const artist = container.querySelector(
      'input[name="artist_name"]'
    ) as HTMLInputElement;
    fireEvent.change(artist, { target: { value: "Mangled" } });
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));

    expect(onUpdate).not.toHaveBeenCalled();
    expect(container.querySelector('input[name="artist_name"]')).toBeNull();
    // Original text is visible again.
    expect(screen.getByText("Juana Molina")).toBeDefined();
  });

  it("fires onDelete when Delete is clicked in the menu", () => {
    const onDelete = vi.fn();
    renderRow({ entry: baseEntry(), onDelete });
    fireEvent.click(screen.getByRole("button", { name: /actions/i }));
    fireEvent.click(screen.getByText("Delete"));
    expect(onDelete).toHaveBeenCalledWith(99);
  });

  it("closes the dropdown when Edit is clicked AND enters edit mode", () => {
    const { container } = renderRow({ entry: baseEntry() });
    fireEvent.click(screen.getByRole("button", { name: /actions/i }));
    expect(container.querySelector(".action-dropdown")).not.toBeNull();
    fireEvent.click(screen.getByRole("menuitem", { name: "Edit" }));
    // Menu closed
    expect(container.querySelector(".action-dropdown")).toBeNull();
    // Row in edit mode
    expect(container.querySelector('input[name="track_title"]')).not.toBeNull();
  });

  it("saves on Enter pressed in any edit input", () => {
    const onUpdate = vi.fn();
    const { container } = renderRow({ entry: baseEntry(), onUpdate });
    fireEvent.click(screen.getByRole("button", { name: /actions/i }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Edit" }));
    const track = container.querySelector(
      'input[name="track_title"]'
    ) as HTMLInputElement;
    fireEvent.change(track, { target: { value: "Edited via Enter" } });
    fireEvent.keyDown(track, { key: "Enter" });
    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(onUpdate).toHaveBeenCalledWith(
      99,
      expect.objectContaining({ track_title: "Edited via Enter" })
    );
    expect(container.querySelector('input[name="track_title"]')).toBeNull();
  });

  it("cancels on Escape pressed in any edit input", () => {
    const onUpdate = vi.fn();
    const { container } = renderRow({ entry: baseEntry(), onUpdate });
    fireEvent.click(screen.getByRole("button", { name: /actions/i }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Edit" }));
    const artist = container.querySelector(
      'input[name="artist_name"]'
    ) as HTMLInputElement;
    fireEvent.change(artist, { target: { value: "MANGLED" } });
    fireEvent.keyDown(artist, { key: "Escape" });
    expect(onUpdate).not.toHaveBeenCalled();
    expect(container.querySelector('input[name="artist_name"]')).toBeNull();
    expect(screen.getByText("Juana Molina")).toBeDefined();
  });

  it("trims whitespace from edited string fields before calling onUpdate", () => {
    const onUpdate = vi.fn();
    const { container } = renderRow({ entry: baseEntry(), onUpdate });
    fireEvent.click(screen.getByRole("button", { name: /actions/i }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Edit" }));
    fireEvent.change(
      container.querySelector('input[name="artist_name"]') as HTMLInputElement,
      { target: { value: "  Juana M.  " } }
    );
    fireEvent.change(
      container.querySelector('input[name="track_title"]') as HTMLInputElement,
      { target: { value: "\tla paradoja\n" } }
    );
    fireEvent.click(screen.getByRole("button", { name: /save/i }));
    expect(onUpdate).toHaveBeenCalledWith(99, {
      artist_name: "Juana M.",
      track_title: "la paradoja",
      album_title: "DOGA",
      record_label: "Sonamos",
      request_flag: false,
    });
  });

  it("does NOT fire onUpdate when track_title is only whitespace", () => {
    const onUpdate = vi.fn();
    const { container } = renderRow({ entry: baseEntry(), onUpdate });
    fireEvent.click(screen.getByRole("button", { name: /actions/i }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Edit" }));
    fireEvent.change(
      container.querySelector('input[name="track_title"]') as HTMLInputElement,
      { target: { value: "   \t  " } }
    );
    fireEvent.click(screen.getByRole("button", { name: /save/i }));
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it("labels the request checkbox so screen readers can announce it", () => {
    const { container } = renderRow({ entry: baseEntry() });
    fireEvent.click(screen.getByRole("button", { name: /actions/i }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Edit" }));
    const checkbox = container.querySelector(
      'input[type="checkbox"][name="request_flag"]'
    ) as HTMLInputElement | null;
    expect(checkbox).not.toBeNull();
    expect(checkbox!.getAttribute("aria-label")).toBe("Listener request");
  });

  it("does NOT render the action menu on talkset rows", () => {
    const entry: FlowsheetEntry = {
      id: 30,
      show_id: 1,
      play_order: 1,
      message: "Talkset - station ID",
    };
    renderRow({ entry });
    expect(
      screen.queryByRole("button", { name: /actions/i })
    ).toBeNull();
  });

  it("does NOT render the action menu on breakpoint rows", () => {
    const entry: FlowsheetEntry = {
      id: 31,
      show_id: 1,
      play_order: 2,
      message: "Breakpoint - 5:00 PM",
      day: "11/14/2023",
      time: "5:00:00 PM",
    };
    renderRow({ entry });
    expect(
      screen.queryByRole("button", { name: /actions/i })
    ).toBeNull();
  });
});
