import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import BinEntry from "./BinEntry";
import type { AlbumEntry } from "@/lib/features/catalog/types";

// Mock child components
vi.mock("../../catalog/ArtistAvatar", () => ({
  ArtistAvatar: ({ artist, entry, format }: any) => (
    <div data-testid="artist-avatar">
      {artist?.name} - {entry}
    </div>
  ),
}));

vi.mock("./BinMenu", () => ({
  default: ({ entry }: any) => (
    <div data-testid="bin-menu">{entry.title}</div>
  ),
}));

vi.mock("./ScrollOnHoverText", () => ({
  default: ({ children }: any) => (
    <span data-testid="scroll-text">{children}</span>
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

  it("should render ArtistAvatar", () => {
    render(<BinEntry entry={mockEntry} />);

    expect(screen.getByTestId("artist-avatar")).toBeInTheDocument();
  });

  it("should render artist name", () => {
    render(<BinEntry entry={mockEntry} />);

    expect(screen.getByText("Test Artist")).toBeInTheDocument();
  });

  it("should render album title", () => {
    render(<BinEntry entry={mockEntry} />);

    // May appear in multiple places (scroll text and bin menu mock)
    expect(screen.getAllByText("Test Album").length).toBeGreaterThan(0);
  });

  it("should render BinMenu", () => {
    render(<BinEntry entry={mockEntry} />);

    expect(screen.getByTestId("bin-menu")).toBeInTheDocument();
  });

  it("should pass entry to ArtistAvatar", () => {
    render(<BinEntry entry={mockEntry} />);

    expect(screen.getByTestId("artist-avatar")).toHaveTextContent("Test Artist - 5");
  });

  it("should render ScrollOnHoverText components", () => {
    render(<BinEntry entry={mockEntry} />);

    expect(screen.getAllByTestId("scroll-text").length).toBe(2);
  });
});
