import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/tests/helpers";

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
import CatalogRotationBinPicker from "@/src/components/experiences/modern/catalog/CatalogRotationBinPicker";

// The bin colors come from the custom `rotation` palette slot, which only
// resolves under the modern theme.
const inModernTheme = (ui: ReactElement) => (
  <CssVarsProvider theme={modernTheme}>{ui}</CssVarsProvider>
);

describe("CatalogRotationBinPicker", () => {
  it("shows the rotation bin label by default and hides it on request", () => {
    renderWithProviders(
      inModernTheme(<CatalogRotationBinPicker selectedBin={null} onSelectBin={vi.fn()} />
      )
    );
    expect(screen.getByText("Rotation bin")).toBeInTheDocument();
  });

  it("renders all four bins as a labeled group", () => {
    renderWithProviders(
      inModernTheme(<CatalogRotationBinPicker
        selectedBin={null}
        onSelectBin={vi.fn()}
        showLabel={false}
      />
      )
    );
    expect(screen.queryByText("Rotation bin")).not.toBeInTheDocument();
    expect(
      screen.getByRole("group", { name: "Rotation bin" })
    ).toBeInTheDocument();
    for (const label of [
      "Heavy rotation",
      "Medium rotation",
      "Light rotation",
      "Singles rotation",
    ]) {
      expect(screen.getByLabelText(label)).toBeInTheDocument();
    }
  });

  it("selects an unselected bin on click", async () => {
    const onSelectBin = vi.fn();
    renderWithProviders(
      inModernTheme(<CatalogRotationBinPicker selectedBin={null} onSelectBin={onSelectBin} />
      )
    );
    await userEvent.click(screen.getByLabelText("Heavy rotation"));
    expect(onSelectBin).toHaveBeenCalledWith("H");
  });

  it("deselects the selected bin on a second click", async () => {
    const onSelectBin = vi.fn();
    renderWithProviders(
      inModernTheme(<CatalogRotationBinPicker selectedBin="H" onSelectBin={onSelectBin} />
      )
    );
    await userEvent.click(screen.getByLabelText("Heavy rotation"));
    expect(onSelectBin).toHaveBeenCalledWith(null);
  });

  it("ignores clicks when disabled", async () => {
    const onSelectBin = vi.fn();
    renderWithProviders(
      inModernTheme(<CatalogRotationBinPicker
        selectedBin={null}
        onSelectBin={onSelectBin}
        disabled
      />
      )
    );
    await userEvent.click(screen.getByLabelText("Heavy rotation"), {
      pointerEventsCheck: 0,
    });
    expect(onSelectBin).not.toHaveBeenCalled();
  });
});
