import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/lib/test-utils";
import CatalogFormStepStage from "./CatalogFormStepStage";

describe("CatalogFormStepStage", () => {
  it("keeps layout height from tallest step while showing only the active layer", () => {
    renderWithProviders(
      <CatalogFormStepStage
        activeStep="short"
        steps={{
          short: <div style={{ height: 80 }}>Short</div>,
          tall: <div style={{ height: 320 }}>Tall</div>,
        }}
      />,
    );

    expect(screen.getByTestId("catalog-form-step-layer-short")).toBeVisible();
    expect(screen.getByTestId("catalog-form-step-layer-tall")).not.toBeVisible();
    expect(screen.getByText("Tall")).toBeInTheDocument();
  });
});
