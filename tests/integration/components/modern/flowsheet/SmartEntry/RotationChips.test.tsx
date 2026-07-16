import { describe, it, expect, vi } from "vitest";
import { fireEvent } from "@testing-library/react";
import { renderWithProviders } from "@/tests/helpers";
import RotationChips from "@/src/components/experiences/modern/flowsheet/SmartEntry/RotationChips";

describe("RotationChips", () => {
  it("renders a button per rotation bin, labelled by its letter", () => {
    const { getByTestId } = renderWithProviders(
      <RotationChips onTakeover={vi.fn()} />
    );
    expect(getByTestId("flowsheet-rotation-H")).toHaveTextContent("H");
    expect(getByTestId("flowsheet-rotation-M")).toBeInTheDocument();
    expect(getByTestId("flowsheet-rotation-L")).toBeInTheDocument();
    expect(getByTestId("flowsheet-rotation-S")).toBeInTheDocument();
  });

  it("carries the full bin name (revealed on hover) and an accessible label", () => {
    const { getByTestId } = renderWithProviders(
      <RotationChips onTakeover={vi.fn()} />
    );
    const heavy = getByTestId("flowsheet-rotation-H");
    expect(heavy).toHaveTextContent("Heavy");
    expect(heavy).toHaveAttribute("aria-label", "Browse Heavy rotation");
  });

  it("invokes onTakeover with the clicked bin", () => {
    const onTakeover = vi.fn();
    const { getByTestId } = renderWithProviders(
      <RotationChips onTakeover={onTakeover} />
    );
    fireEvent.click(getByTestId("flowsheet-rotation-M"));
    expect(onTakeover).toHaveBeenCalledWith("M");
    fireEvent.click(getByTestId("flowsheet-rotation-S"));
    expect(onTakeover).toHaveBeenCalledWith("S");
  });

  it("is not keyboard-focusable (pointer affordance inside the mirror)", () => {
    const { getByTestId } = renderWithProviders(
      <RotationChips onTakeover={vi.fn()} />
    );
    expect(getByTestId("flowsheet-rotation-H")).toHaveAttribute(
      "tabindex",
      "-1"
    );
  });
});
