import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/lib/test-utils/render";
import { createTestFlowsheetEntry } from "@/lib/test-utils";
import { Rotation } from "@/lib/features/rotation/types";
import type { FlowsheetEntry } from "@/lib/features/flowsheet/types";
import EntryRow from "../EntryRow";

// renderInTable wraps EntryRow in a <table><tbody> so the row's <td> elements
// are mounted in a valid layout context (RTL otherwise warns).
function renderRow(props: {
  entry: FlowsheetEntry;
  index?: number;
  totalEntries?: number;
  nextIsSong?: boolean;
}) {
  return renderWithProviders(
    <table>
      <tbody>
        <EntryRow
          entry={props.entry}
          index={props.index ?? 1}
          totalEntries={props.totalEntries ?? 3}
          fontSize={3}
          onEdit={() => {}}
          onDelete={() => {}}
          onMoveUp={() => {}}
          onMoveDown={() => {}}
          nextIsSong={props.nextIsSong}
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

  it("renders the indicators inside a single leftmost <td> cell", () => {
    const entry = createTestFlowsheetEntry({ request_flag: true });
    const { container } = renderRow({ entry });
    const firstCell = container.querySelector("tr > td:first-child");
    expect(firstCell).not.toBeNull();
    expect(firstCell!.querySelector(".classic-capsule")).not.toBeNull();
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

    it("renders the lowercase word 'talkset' centered", () => {
      const { container } = renderRow({ entry: talksetEntry });
      const cell = container.querySelector("tr > td:first-child");
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
      const cell = container.querySelector("tr > td:first-child");
      expect(cell).not.toBeNull();
      expect(cell!.textContent).toBe("5:00 PM breakpoint");
    });

    it("renders content centered", () => {
      const { container } = renderRow({ entry: breakpointEntry });
      const cell = container.querySelector("tr > td:first-child");
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
      const cell = container.querySelector("tr > td:first-child");
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
      const cell = container.querySelector("tr > td:first-child");
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
      const cell = container.querySelector("tr > td:first-child");
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
    const cell = container.querySelector("tr > td:first-child");
    expect(cell!.textContent).toBe(
      "Start of show — DJ Test @ Unknown Unknown"
    );
  });
});
