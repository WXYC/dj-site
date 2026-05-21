import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import CatalogEditMenu from "./CatalogEditMenu";

vi.mock("@/src/hooks/catalogHooks", () => ({
  useCanEditCatalog: vi.fn(),
}));

vi.mock("@/lib/hooks", () => ({
  useAppDispatch: () => vi.fn(),
}));

import { useCanEditCatalog } from "@/src/hooks/catalogHooks";

describe("CatalogEditMenu", () => {
  it("renders nothing when user cannot edit catalog", () => {
    vi.mocked(useCanEditCatalog).mockReturnValue(false);
    const { container } = render(<CatalogEditMenu />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders Edit button when user can edit catalog", () => {
    vi.mocked(useCanEditCatalog).mockReturnValue(true);
    render(<CatalogEditMenu />);
    expect(screen.getByTestId("catalog-edit-button")).toHaveTextContent("Edit");
  });
});
