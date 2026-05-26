import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { renderWithProviders } from "@/lib/test-utils";
import CatalogEntryFormTabs, { type CatalogEditTab } from "./CatalogEntryFormTabs";

function TabsHarness() {
  const [activeTab, setActiveTab] = useState<CatalogEditTab>("artist");
  return (
    <CatalogEntryFormTabs
      activeTab={activeTab}
      onTabChange={setActiveTab}
      artistPanel={<div data-testid="artist-panel-content">Artist panel</div>}
      albumPanel={<div data-testid="album-panel-content">Album panel</div>}
      rotationPanel={<div data-testid="rotation-panel-content">Rotation panel</div>}
    />
  );
}

describe("CatalogEntryFormTabs", () => {
  it("switches tab panels on click", async () => {
    const user = userEvent.setup();
    renderWithProviders(<TabsHarness />);

    expect(screen.getByTestId("artist-panel-content")).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: "Album" }));
    expect(screen.getByTestId("album-panel-content")).toBeInTheDocument();
  });
});
