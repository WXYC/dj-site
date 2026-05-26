import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/lib/test-utils";
import CatalogEntryFormWizard from "./CatalogEntryFormWizard";

describe("CatalogEntryFormWizard", () => {
  it("shows only the active step layer while mounting all steps for stable height", () => {
    renderWithProviders(
      <CatalogEntryFormWizard
        step="artist"
        artistPanel={<div data-testid="artist-only">Artist</div>}
        albumPanel={<div data-testid="album-only">Album</div>}
        rotationPanel={<div data-testid="rotation-only">Rotation</div>}
      />,
    );

    expect(screen.getByTestId("artist-only")).toBeVisible();
    expect(screen.getByTestId("album-only")).not.toBeVisible();
    expect(screen.getByTestId("rotation-only")).not.toBeVisible();
  });
});
