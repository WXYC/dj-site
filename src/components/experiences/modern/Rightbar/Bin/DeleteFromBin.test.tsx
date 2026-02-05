import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import DeleteFromBin from "./DeleteFromBin";
import type { AlbumEntry } from "@/lib/features/catalog/types";
import { Menu } from "@mui/joy";

// Mock hooks
const mockDeleteFromBin = vi.fn();

vi.mock("@/src/hooks/binHooks", () => ({
  useDeleteFromBin: vi.fn(() => ({
    deleteFromBin: mockDeleteFromBin,
  })),
}));

// Mock MUI icons
vi.mock("@mui/icons-material", () => ({
  DeleteOutline: () => <span data-testid="delete-icon" />,
}));

// Wrapper component to provide Menu context
function MenuWrapper({ children }: { children: React.ReactNode }) {
  return (
    <Menu open={true} anchorEl={null}>
      {children}
    </Menu>
  );
}

describe("DeleteFromBin", () => {
  const mockAlbum: AlbumEntry = {
    id: 42,
    title: "Test Album Title",
    entry: 5,
    format: "CD",
    artist: {
      id: 1,
      name: "Test Artist",
      lettercode: "TA",
      numbercode: 100,
      genre: "Rock",
    },
  } as AlbumEntry;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render menu item with album title", () => {
    render(
      <MenuWrapper>
        <DeleteFromBin album={mockAlbum} />
      </MenuWrapper>
    );

    expect(screen.getByText("Remove Test Album Title from Bin")).toBeInTheDocument();
  });

  it("should render delete icon", () => {
    render(
      <MenuWrapper>
        <DeleteFromBin album={mockAlbum} />
      </MenuWrapper>
    );

    expect(screen.getByTestId("delete-icon")).toBeInTheDocument();
  });

  it("should call deleteFromBin when clicked", () => {
    render(
      <MenuWrapper>
        <DeleteFromBin album={mockAlbum} />
      </MenuWrapper>
    );

    const menuItem = screen.getByRole("menuitem");
    fireEvent.click(menuItem);

    expect(mockDeleteFromBin).toHaveBeenCalledWith(42);
  });

  it("should render as menuitem role", () => {
    render(
      <MenuWrapper>
        <DeleteFromBin album={mockAlbum} />
      </MenuWrapper>
    );

    expect(screen.getByRole("menuitem")).toBeInTheDocument();
  });

  it("should call deleteFromBin with correct album id", () => {
    const anotherAlbum: AlbumEntry = {
      ...mockAlbum,
      id: 99,
      title: "Another Album",
    };

    render(
      <MenuWrapper>
        <DeleteFromBin album={anotherAlbum} />
      </MenuWrapper>
    );

    const menuItem = screen.getByRole("menuitem");
    fireEvent.click(menuItem);

    expect(mockDeleteFromBin).toHaveBeenCalledWith(99);
  });
});
