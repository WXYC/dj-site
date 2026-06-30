import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/lib/test-utils";
import CatalogRotationBinPicker from "./CatalogRotationBinPicker";

describe("CatalogRotationBinPicker", () => {
  it("shows rotation bin label by default", () => {
    renderWithProviders(
      <CatalogRotationBinPicker
        selectedBin={null}
        onSelectBin={vi.fn()}
      />,
    );
    expect(screen.getByText("Rotation bin")).toBeInTheDocument();
  });

  it("hides rotation bin label when showLabel is false", () => {
    renderWithProviders(
      <CatalogRotationBinPicker
        selectedBin={null}
        onSelectBin={vi.fn()}
        showLabel={false}
      />,
    );
    expect(screen.queryByText("Rotation bin")).not.toBeInTheDocument();
    expect(screen.getByRole("radiogroup", { name: "Rotation bin" })).toBeInTheDocument();
  });
});
