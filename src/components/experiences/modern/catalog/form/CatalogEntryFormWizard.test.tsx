import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/lib/test-utils";
import CatalogEntryFormWizard from "./CatalogEntryFormWizard";

describe("CatalogEntryFormWizard", () => {
  it("renders only the active step panel", () => {
    renderWithProviders(
      <CatalogEntryFormWizard
        step="artist"
        artistPanel={<div data-testid="artist-only">Artist</div>}
        albumPanel={<div data-testid="album-only">Album</div>}
        rotationPanel={<div data-testid="rotation-only">Rotation</div>}
      />,
    );

    expect(screen.getByTestId("artist-only")).toBeInTheDocument();
    expect(screen.queryByTestId("album-only")).not.toBeInTheDocument();
    expect(screen.queryByTestId("rotation-only")).not.toBeInTheDocument();
  });
});
