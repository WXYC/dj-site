import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import CatalogEditMenu from "./CatalogEditMenu";

vi.mock("@/src/hooks/catalogHooks", () => ({
  useCanEditCatalog: vi.fn(),
}));

const mockOpenAlbumAdd = vi.fn();

vi.mock("@/src/hooks/useCatalogAlbumNavigation", () => ({
  useCatalogAlbumNavigation: () => ({
    openAlbumAdd: mockOpenAlbumAdd,
  }),
}));

import { useCanEditCatalog } from "@/src/hooks/catalogHooks";

describe("CatalogEditMenu", () => {
  it("renders nothing when user cannot edit catalog", () => {
    vi.mocked(useCanEditCatalog).mockReturnValue(false);
    const { container } = render(<CatalogEditMenu />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders Add button when user can edit catalog", async () => {
    vi.mocked(useCanEditCatalog).mockReturnValue(true);
    render(<CatalogEditMenu />);
    await waitFor(() => {
      expect(screen.getByTestId("catalog-add-button")).toHaveTextContent("Add");
    });
  });
});
