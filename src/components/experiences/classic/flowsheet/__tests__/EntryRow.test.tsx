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
