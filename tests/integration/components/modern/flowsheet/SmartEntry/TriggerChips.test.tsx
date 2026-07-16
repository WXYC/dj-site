import { describe, it, expect, vi } from "vitest";
import { fireEvent } from "@testing-library/react";
import { renderWithProviders } from "@/tests/helpers";
import type { SmartField } from "@/src/components/experiences/modern/flowsheet/SmartEntry/parser/types";
import TriggerChips from "@/src/components/experiences/modern/flowsheet/SmartEntry/TriggerChips";

const renderChips = (
  props: { isClaimed?: (field: SmartField) => boolean } = {}
) => {
  const onInsert = vi.fn();
  const result = renderWithProviders(
    <TriggerChips
      isClaimed={props.isClaimed ?? (() => false)}
      onInsert={onInsert}
    />
  );
  return { ...result, onInsert };
};

describe("TriggerChips", () => {
  it("inserts the field's trigger word on click", () => {
    const { getByTestId, onInsert } = renderChips();
    fireEvent.click(getByTestId("flowsheet-trigger-artist"));
    expect(onInsert).toHaveBeenCalledWith("by");
    fireEvent.click(getByTestId("flowsheet-trigger-album"));
    expect(onInsert).toHaveBeenCalledWith("on");
    fireEvent.click(getByTestId("flowsheet-trigger-label"));
    expect(onInsert).toHaveBeenCalledWith("via");
  });

  it("hides a chip whose field is already claimed", () => {
    const { queryByTestId, getByTestId } = renderChips({
      isClaimed: (field) => field === "artist",
    });
    expect(queryByTestId("flowsheet-trigger-artist")).toBeNull();
    // the unclaimed fields still render
    expect(getByTestId("flowsheet-trigger-album")).toBeInTheDocument();
    expect(getByTestId("flowsheet-trigger-label")).toBeInTheDocument();
  });

  it("renders nothing once every field is claimed", () => {
    const { queryByTestId } = renderChips({ isClaimed: () => true });
    expect(queryByTestId("flowsheet-trigger-chips")).toBeNull();
  });

  it("is not keyboard-focusable (pointer affordance inside the mirror)", () => {
    const { getByTestId } = renderChips();
    expect(getByTestId("flowsheet-trigger-artist")).toHaveAttribute(
      "tabindex",
      "-1"
    );
  });

  it("keeps composer focus by preventing the mousedown default", () => {
    const { getByTestId } = renderChips();
    const notPrevented = fireEvent.mouseDown(
      getByTestId("flowsheet-trigger-artist")
    );
    // fireEvent returns false when a handler called preventDefault.
    expect(notPrevented).toBe(false);
  });
});
