import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import BinEntry from "./BinEntry";
import type { AlbumEntry } from "@/lib/features/catalog/types";

// Mock child components
vi.mock("../../catalog/ArtistAvatar", () => ({
  ArtistAvatar: ({ artist, entry }: any) => (
    <div data-testid="artist-avatar">
      {artist?.name} - {entry}
    </div>
  ),
}));

// The actions hook is exercised on its own; here we just assert wiring.
vi.mock("./useBinEntryActions", () => ({
  useBinEntryActions: (_entry: any, live: boolean) => [
    { id: "info", label: "More information", Icon: () => null, color: "neutral", run: vi.fn() },
    ...(live ? [{ id: "play", label: "Play Now", Icon: () => null, color: "primary", run: vi.fn() }] : []),
  ],
}));

vi.mock("./BinEntryActions", () => ({
  default: ({ actions }: any) => (
    <div data-testid="bin-actions">{actions.length}</div>
  ),
}));

vi.mock("./BinEntryContextMenu", () => ({
  default: ({ anchor }: any) => (
    <div data-testid="bin-context-menu">{anchor ? "open" : "closed"}</div>
  ),
}));

describe("BinEntry", () => {
  const mockEntry: AlbumEntry = {
    id: 1,
    title: "Test Album",
    entry: 5,
    format: "CD",
    artist: {
      id: 1,
      name: "Test Artist",
      lettercode: "AB",
      numbercode: 123,
      genre: "Rock",
    },
  } as AlbumEntry;

  // Hoisted once in BinContent and threaded down; the row never runs the
  // heavy queue/flowsheet hooks itself.
  const actionDeps = {
    addToQueue: vi.fn(),
    addToFlowsheet: vi.fn(() => Promise.resolve()),
    deleteFromBin: vi.fn(),
  };

  it("should render ArtistAvatar with entry data", () => {
    render(<BinEntry entry={mockEntry} live={false} actionDeps={actionDeps} />);

    expect(screen.getByTestId("artist-avatar")).toHaveTextContent(
      "Test Artist - 5"
    );
  });

  it("should render album title and artist name", () => {
    render(<BinEntry entry={mockEntry} live={false} actionDeps={actionDeps} />);

    expect(screen.getByText("Test Album")).toBeInTheDocument();
    expect(screen.getByText("Test Artist")).toBeInTheDocument();
  });

  it("shows the full title in a real tooltip on hover (not the native title attr)", async () => {
    render(<BinEntry entry={mockEntry} live={false} actionDeps={actionDeps} />);

    expect(screen.queryByTitle("Test Album")).not.toBeInTheDocument();
    fireEvent.mouseOver(screen.getByText("Test Album"));
    expect(
      await screen.findByRole("tooltip", {}, { timeout: 2000 })
    ).toHaveTextContent("Test Album");
  });

  it("should render the hover action buttons", () => {
    render(<BinEntry entry={mockEntry} live={false} actionDeps={actionDeps} />);

    expect(screen.getByTestId("bin-actions")).toBeInTheDocument();
  });

  it("should include live-only actions when a show is live", () => {
    const { rerender } = render(
      <BinEntry entry={mockEntry} live={false} actionDeps={actionDeps} />
    );
    expect(screen.getByTestId("bin-actions")).toHaveTextContent("1");

    rerender(<BinEntry entry={mockEntry} live={true} actionDeps={actionDeps} />);
    expect(screen.getByTestId("bin-actions")).toHaveTextContent("2");
  });

  it("should open the context menu at the cursor on right-click", () => {
    const { container } = render(
      <BinEntry entry={mockEntry} live={false} actionDeps={actionDeps} />
    );

    expect(screen.getByTestId("bin-context-menu")).toHaveTextContent("closed");

    fireEvent.contextMenu(container.firstChild as Element, {
      clientX: 10,
      clientY: 20,
    });

    expect(screen.getByTestId("bin-context-menu")).toHaveTextContent("open");
  });
});
