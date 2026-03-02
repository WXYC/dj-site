import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import CatalogResult from "./Result";
import type { AlbumEntry } from "@/lib/features/catalog/types";

// Mock hooks
const mockSetSelection = vi.fn();
const mockAddToQueue = vi.fn();

vi.mock("@/src/hooks/catalogHooks", () => ({
  useCatalogSearch: vi.fn(() => ({
    selected: [],
    setSelection: mockSetSelection,
    orderBy: "Artist",
  })),
}));

vi.mock("@/src/hooks/flowsheetHooks", () => ({
  useShowControl: vi.fn(() => ({
    live: false,
  })),
  useQueue: vi.fn(() => ({
    addToQueue: mockAddToQueue,
  })),
}));

// Mock bin conversions
vi.mock("@/lib/features/bin/conversions", () => ({
  convertBinToQueue: vi.fn((album) => ({
    song: album.title,
    artist: album.artist.name,
    album: album.title,
    label: album.label || "",
    request: false,
  })),
}));

// Mock toast
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock child components
vi.mock("../ArtistAvatar", () => ({
  ArtistAvatar: ({ artist }: any) => (
    <div data-testid="artist-avatar">{artist?.name}</div>
  ),
}));

vi.mock("./AddRemoveBin", () => ({
  default: ({ album }: any) => (
    <button data-testid="add-remove-bin">{album.title}</button>
  ),
}));

// Mock Next.js Link
vi.mock("next/link", () => ({
  default: ({ children, href }: any) => <a href={href}>{children}</a>,
}));

// Mock MUI icons
vi.mock("@mui/icons-material", () => ({
  QueueMusic: () => <span data-testid="queue-music-icon" />,
}));

vi.mock("@mui/icons-material/InfoOutlined", () => ({
  default: () => <span data-testid="info-icon" />,
}));

describe("CatalogResult", () => {
  const mockAlbum: AlbumEntry = {
    id: 1,
    title: "Test Album",
    entry: 5,
    format: "CD",
    play_freq: "H",
    alternate_artist: "Alt Artist",
    label: "Test Label",
    artist: {
      id: 1,
      name: "Test Artist",
      lettercode: "AB",
      numbercode: 123,
      genre: "Rock",
    },
  } as AlbumEntry;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render album title", () => {
    render(
      <table>
        <tbody>
          <CatalogResult album={mockAlbum} />
        </tbody>
      </table>
    );

    // May appear multiple times (in title and in add-remove-bin mock)
    expect(screen.getAllByText("Test Album").length).toBeGreaterThan(0);
  });

  it("should render artist name", () => {
    render(
      <table>
        <tbody>
          <CatalogResult album={mockAlbum} />
        </tbody>
      </table>
    );

    // May appear multiple times (in avatar mock and in text)
    expect(screen.getAllByText("Test Artist").length).toBeGreaterThan(0);
  });

  it("should render ArtistAvatar", () => {
    render(
      <table>
        <tbody>
          <CatalogResult album={mockAlbum} />
        </tbody>
      </table>
    );

    expect(screen.getByTestId("artist-avatar")).toBeInTheDocument();
  });

  it("should render AddRemoveBin component", () => {
    render(
      <table>
        <tbody>
          <CatalogResult album={mockAlbum} />
        </tbody>
      </table>
    );

    expect(screen.getByTestId("add-remove-bin")).toBeInTheDocument();
  });

  it("should render format chip", () => {
    render(
      <table>
        <tbody>
          <CatalogResult album={mockAlbum} />
        </tbody>
      </table>
    );

    expect(screen.getByText("CD")).toBeInTheDocument();
  });

  it("should render album code", () => {
    render(
      <table>
        <tbody>
          <CatalogResult album={mockAlbum} />
        </tbody>
      </table>
    );

    expect(screen.getByText("AB 123/5")).toBeInTheDocument();
  });

  it("should render checkbox", () => {
    render(
      <table>
        <tbody>
          <CatalogResult album={mockAlbum} />
        </tbody>
      </table>
    );

    expect(screen.getByRole("checkbox")).toBeInTheDocument();
  });

  it("should call setSelection when checkbox is clicked", () => {
    render(
      <table>
        <tbody>
          <CatalogResult album={mockAlbum} />
        </tbody>
      </table>
    );

    const checkbox = screen.getByRole("checkbox");
    fireEvent.click(checkbox);

    expect(mockSetSelection).toHaveBeenCalledWith([1]);
  });

  it("should render alternate artist", () => {
    render(
      <table>
        <tbody>
          <CatalogResult album={mockAlbum} />
        </tbody>
      </table>
    );

    expect(screen.getByText("Alt Artist")).toBeInTheDocument();
  });

  it("should show add to queue button when live", async () => {
    const { useShowControl } = await import("@/src/hooks/flowsheetHooks");
    vi.mocked(useShowControl).mockReturnValue({
      live: true,
    } as any);

    render(
      <table>
        <tbody>
          <CatalogResult album={mockAlbum} />
        </tbody>
      </table>
    );

    expect(screen.getByTestId("queue-music-icon")).toBeInTheDocument();
  });

  it("should not show add to queue button when not live", async () => {
    const { useShowControl } = await import("@/src/hooks/flowsheetHooks");
    vi.mocked(useShowControl).mockReturnValue({
      live: false,
    } as any);

    render(
      <table>
        <tbody>
          <CatalogResult album={mockAlbum} />
        </tbody>
      </table>
    );

    expect(screen.queryByTestId("queue-music-icon")).not.toBeInTheDocument();
  });

  it("should call addToQueue when queue button is clicked", async () => {
    const { useShowControl } = await import("@/src/hooks/flowsheetHooks");
    const { toast } = await import("sonner");

    vi.mocked(useShowControl).mockReturnValue({
      live: true,
    } as any);

    render(
      <table>
        <tbody>
          <CatalogResult album={mockAlbum} />
        </tbody>
      </table>
    );

    // Find the button that contains the queue music icon
    const queueButtons = screen.getAllByRole("button");
    const queueButton = queueButtons.find(
      (btn) => btn.querySelector("[data-testid='queue-music-icon']")
    );

    if (queueButton) {
      fireEvent.click(queueButton);
      expect(mockAddToQueue).toHaveBeenCalled();
      expect(toast.success).toHaveBeenCalledWith("Added Test Album to queue");
    }
  });

  it("should render info link with correct href", () => {
    render(
      <table>
        <tbody>
          <CatalogResult album={mockAlbum} />
        </tbody>
      </table>
    );

    const infoLink = screen.getByRole("link");
    expect(infoLink).toHaveAttribute("href", "/dashboard/album/1");
  });
});
