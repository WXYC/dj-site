import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { renderWithProviders } from "@/tests/helpers";
import RotationBinSelector from "./RotationBinSelector";
import { Rotation } from "@/lib/features/rotation/types";

// Mock fonts before importing the modern theme (pulled in for the rotation palette).
vi.mock("next/font/google", () => ({
  Kanit: () => ({ style: { fontFamily: "Kanit, sans-serif" } }),
}));
vi.mock("next/font/local", () => ({
  default: () => ({ style: { fontFamily: "Minbus, sans-serif" } }),
}));

import { CssVarsProvider } from "@mui/joy/styles";
import type { ReactElement } from "react";
import modernTheme from "@/lib/features/experiences/modern/theme";

// The bin colors come from the custom `rotation` palette slot, which only
// resolves under the modern theme (see LeftbarContainer.test for the pattern).
const inModernTheme = (ui: ReactElement) => (
  <CssVarsProvider theme={modernTheme}>{ui}</CssVarsProvider>
);


describe("RotationBinSelector", () => {
  const mockOnSelectBin = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render four bin buttons", () => {
    renderWithProviders(inModernTheme(<RotationBinSelector selectedBin={null} onSelectBin={mockOnSelectBin} disabled={false} />));
    expect(screen.getByText("H")).toBeInTheDocument();
    expect(screen.getByText("M")).toBeInTheDocument();
    expect(screen.getByText("L")).toBeInTheDocument();
    expect(screen.getByText("S")).toBeInTheDocument();
  });

  it("should call onSelectBin when a bin is clicked", () => {
    renderWithProviders(inModernTheme(<RotationBinSelector selectedBin={null} onSelectBin={mockOnSelectBin} disabled={false} />));
    fireEvent.click(screen.getByRole("radio", { name: "H" }));
    expect(mockOnSelectBin).toHaveBeenCalledWith(Rotation.H);
  });

  it.each(["H", "M", "L", "S"])("should call onSelectBin with %s", (bin) => {
    renderWithProviders(inModernTheme(<RotationBinSelector selectedBin={null} onSelectBin={mockOnSelectBin} disabled={false} />));
    fireEvent.click(screen.getByRole("radio", { name: bin }));
    expect(mockOnSelectBin).toHaveBeenCalledWith(bin);
  });

  it("should not call onSelectBin when disabled", () => {
    renderWithProviders(inModernTheme(<RotationBinSelector selectedBin={null} onSelectBin={mockOnSelectBin} disabled={true} />));
    // Disabled buttons don't fire click events in the DOM
    const radio = screen.getByRole("radio", { name: "H" });
    fireEvent.click(radio);
    expect(mockOnSelectBin).not.toHaveBeenCalled();
  });

  it("should have radiogroup role for accessibility", () => {
    renderWithProviders(inModernTheme(<RotationBinSelector selectedBin={null} onSelectBin={mockOnSelectBin} disabled={false} />));
    expect(screen.getByRole("radiogroup")).toBeInTheDocument();
  });
});
