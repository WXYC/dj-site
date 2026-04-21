import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { renderWithProviders } from "@/lib/test-utils";
import RotationBinSelector from "./RotationBinSelector";
import { Rotation } from "@/lib/features/rotation/types";

describe("RotationBinSelector", () => {
  const mockOnSelectBin = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render four bin buttons", () => {
    renderWithProviders(
      <RotationBinSelector selectedBin={null} onSelectBin={mockOnSelectBin} disabled={false} />
    );
    expect(screen.getByText("H")).toBeInTheDocument();
    expect(screen.getByText("M")).toBeInTheDocument();
    expect(screen.getByText("L")).toBeInTheDocument();
    expect(screen.getByText("S")).toBeInTheDocument();
  });

  it("should call onSelectBin when a bin is clicked", () => {
    renderWithProviders(
      <RotationBinSelector selectedBin={null} onSelectBin={mockOnSelectBin} disabled={false} />
    );
    fireEvent.click(screen.getByRole("radio", { name: "H" }));
    expect(mockOnSelectBin).toHaveBeenCalledWith(Rotation.H);
  });

  it.each(["H", "M", "L", "S"])("should call onSelectBin with %s", (bin) => {
    renderWithProviders(
      <RotationBinSelector selectedBin={null} onSelectBin={mockOnSelectBin} disabled={false} />
    );
    fireEvent.click(screen.getByRole("radio", { name: bin }));
    expect(mockOnSelectBin).toHaveBeenCalledWith(bin);
  });

  it("should not call onSelectBin when disabled", () => {
    renderWithProviders(
      <RotationBinSelector selectedBin={null} onSelectBin={mockOnSelectBin} disabled={true} />
    );
    // Disabled buttons don't fire click events in the DOM
    const radio = screen.getByRole("radio", { name: "H" });
    fireEvent.click(radio);
    expect(mockOnSelectBin).not.toHaveBeenCalled();
  });

  it("should have radiogroup role for accessibility", () => {
    renderWithProviders(
      <RotationBinSelector selectedBin={null} onSelectBin={mockOnSelectBin} disabled={false} />
    );
    expect(screen.getByRole("radiogroup")).toBeInTheDocument();
  });
});
