import { describe, it, expect, vi } from "vitest";
import { fireEvent } from "@testing-library/react";
import { renderWithProviders } from "@/tests/helpers";
import RotationTag from "@/src/components/experiences/modern/flowsheet/SmartEntry/RotationTag";

describe("RotationTag", () => {
  it("shows the selected bin's full name and an accessible exit label", () => {
    const { getByTestId } = renderWithProviders(
      <RotationTag bin="H" onClear={vi.fn()} />
    );
    const tag = getByTestId("flowsheet-rotation-tag");
    expect(tag).toHaveTextContent("Heavy");
    expect(tag).toHaveAttribute("aria-label", "Exit Heavy rotation");
  });

  it("calls onClear when clicked (exits rotation mode)", () => {
    const onClear = vi.fn();
    const { getByTestId } = renderWithProviders(
      <RotationTag bin="M" onClear={onClear} />
    );
    fireEvent.click(getByTestId("flowsheet-rotation-tag"));
    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it("is keyboard-reachable (unlike the pointer-only chips)", () => {
    const { getByTestId } = renderWithProviders(
      <RotationTag bin="S" onClear={vi.fn()} />
    );
    // a real <button> with no negative tabindex
    expect(getByTestId("flowsheet-rotation-tag")).not.toHaveAttribute(
      "tabindex",
      "-1"
    );
  });
});
