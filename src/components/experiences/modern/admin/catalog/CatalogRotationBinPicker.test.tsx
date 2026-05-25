import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CssVarsProvider } from "@mui/joy/styles";
import CatalogRotationBinPicker from "./CatalogRotationBinPicker";

function renderPicker(
  props: Partial<React.ComponentProps<typeof CatalogRotationBinPicker>> = {},
) {
  const onSelectBin = vi.fn();
  const result = render(
    <CssVarsProvider>
      <CatalogRotationBinPicker
        selectedBin={null}
        onSelectBin={onSelectBin}
        {...props}
      />
    </CssVarsProvider>,
  );
  return { ...result, onSelectBin };
}

describe("CatalogRotationBinPicker", () => {
  it("selects a single bin", async () => {
    const user = userEvent.setup();
    const { onSelectBin } = renderPicker();

    await user.click(screen.getByLabelText("Medium rotation"));

    expect(onSelectBin).toHaveBeenCalledWith("M");
  });

  it("clears selection when clicking the active bin again", async () => {
    const user = userEvent.setup();
    const { onSelectBin } = renderPicker({ selectedBin: "H" });

    await user.click(screen.getByLabelText("Heavy rotation"));

    expect(onSelectBin).toHaveBeenCalledWith(null);
  });

  it("does not call onSelectBin when disabled", async () => {
    const user = userEvent.setup();
    const { onSelectBin } = renderPicker({ disabled: true });

    await user.click(screen.getByLabelText("Light rotation"));

    expect(onSelectBin).not.toHaveBeenCalled();
  });
});
