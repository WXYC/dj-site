import { describe, it, expect } from "vitest";
import { renderWithProviders } from "@/tests/helpers";
import ShortcutGuide from "@/src/components/experiences/modern/flowsheet/SmartEntry/ShortcutGuide";

describe("ShortcutGuide", () => {
  it("always lists the core shortcuts", () => {
    const { getByTestId } = renderWithProviders(
      <ShortcutGuide tabHint={null} ghostActive={false} showResultsNav={false} />
    );
    const guide = getByTestId("flowsheet-shortcut-guide");
    expect(guide).toHaveTextContent("play");
    expect(guide).toHaveTextContent("queue");
    expect(guide).toHaveTextContent("Esc");
    expect(guide).toHaveTextContent("cancel");
  });

  it("shows the live Tab hint when present, and hides it when null", () => {
    const { getByTestId, rerender } = renderWithProviders(
      <ShortcutGuide
        tabHint="add artist"
        ghostActive={false}
        showResultsNav={false}
      />
    );
    expect(getByTestId("flowsheet-shortcut-guide")).toHaveTextContent(
      "add artist"
    );
    rerender(
      <ShortcutGuide tabHint={null} ghostActive={false} showResultsNav={false} />
    );
    expect(getByTestId("flowsheet-shortcut-guide")).not.toHaveTextContent(
      "Tab"
    );
  });

  it("surfaces accept-suggestion only when a ghost is active", () => {
    const { getByTestId, queryByTestId, rerender } = renderWithProviders(
      <ShortcutGuide tabHint={null} ghostActive={false} showResultsNav={false} />
    );
    expect(queryByTestId("flowsheet-shortcut-guide")).not.toHaveTextContent(
      "accept"
    );
    rerender(
      <ShortcutGuide tabHint={null} ghostActive={true} showResultsNav={false} />
    );
    expect(getByTestId("flowsheet-shortcut-guide")).toHaveTextContent("accept");
  });

  it("surfaces results navigation only when there are results", () => {
    const { getByTestId } = renderWithProviders(
      <ShortcutGuide tabHint={null} ghostActive={false} showResultsNav={true} />
    );
    expect(getByTestId("flowsheet-shortcut-guide")).toHaveTextContent(
      "navigate"
    );
  });
});
