import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import AddToQueueFromBin from "./AddToQueueFromBin";
import type { AlbumEntry } from "@/lib/features/catalog/types";
import { Menu } from "@mui/joy";

// Mock hooks
const mockAddToQueue = vi.fn();
const mockDeleteFromBin = vi.fn();

vi.mock("@/src/hooks/applicationHooks", () => ({
  useShiftKey: vi.fn(() => false),
}));

vi.mock("@/src/hooks/binHooks", () => ({
  useDeleteFromBin: vi.fn(() => ({
    deleteFromBin: mockDeleteFromBin,
  })),
}));

vi.mock("@/src/hooks/flowsheetHooks", () => ({
  useQueue: vi.fn(() => ({
    addToQueue: mockAddToQueue,
  })),
}));

vi.mock("@/lib/features/bin/conversions", () => ({
  convertBinToQueue: vi.fn((entry) => ({ converted: entry })),
}));

// Mock MUI icons
vi.mock("@mui/icons-material/PlaylistAdd", () => ({
  default: () => <span data-testid="playlist-add-icon" />,
}));

// Wrapper component to provide Menu context
function MenuWrapper({ children }: { children: React.ReactNode }) {
  return (
    <Menu open={true} anchorEl={null}>
      {children}
    </Menu>
  );
}

describe("AddToQueueFromBin", () => {
  const mockEntry: AlbumEntry = {
    id: 1,
    title: "Test Album",
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

  it("should render menu item with text", () => {
    render(
      <MenuWrapper>
        <AddToQueueFromBin entry={mockEntry} />
      </MenuWrapper>
    );

    expect(screen.getByText("Add to Queue")).toBeInTheDocument();
  });

  it("should render playlist add icon", () => {
    render(
      <MenuWrapper>
        <AddToQueueFromBin entry={mockEntry} />
      </MenuWrapper>
    );

    expect(screen.getByTestId("playlist-add-icon")).toBeInTheDocument();
  });

  it("should render shift hint", () => {
    render(
      <MenuWrapper>
        <AddToQueueFromBin entry={mockEntry} />
      </MenuWrapper>
    );

    expect(screen.getByText("+ Shift")).toBeInTheDocument();
    expect(screen.getByText("to remove from bin")).toBeInTheDocument();
  });

  it("should call addToQueue when clicked", () => {
    render(
      <MenuWrapper>
        <AddToQueueFromBin entry={mockEntry} />
      </MenuWrapper>
    );

    const menuItem = screen.getByRole("menuitem");
    fireEvent.click(menuItem);

    expect(mockAddToQueue).toHaveBeenCalled();
  });

  it("should not call deleteFromBin when shift is not pressed", () => {
    render(
      <MenuWrapper>
        <AddToQueueFromBin entry={mockEntry} />
      </MenuWrapper>
    );

    const menuItem = screen.getByRole("menuitem");
    fireEvent.click(menuItem);

    expect(mockDeleteFromBin).not.toHaveBeenCalled();
  });

  it("should call deleteFromBin when shift is pressed", async () => {
    const { useShiftKey } = await import("@/src/hooks/applicationHooks");
    vi.mocked(useShiftKey).mockReturnValue(true);

    render(
      <MenuWrapper>
        <AddToQueueFromBin entry={mockEntry} />
      </MenuWrapper>
    );

    const menuItem = screen.getByRole("menuitem");
    fireEvent.click(menuItem);

    expect(mockDeleteFromBin).toHaveBeenCalledWith(1);
    expect(mockAddToQueue).toHaveBeenCalled();
  });

  it("should render as menuitem role", () => {
    render(
      <MenuWrapper>
        <AddToQueueFromBin entry={mockEntry} />
      </MenuWrapper>
    );

    expect(screen.getByRole("menuitem")).toBeInTheDocument();
  });
});
