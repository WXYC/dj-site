import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import RemoveFromBin from "./RemoveFromBin";

const mockDeleteFromBin = vi.fn();

vi.mock("@/src/hooks/binHooks", () => ({
  useDeleteFromBin: () => ({
    deleteFromBin: mockDeleteFromBin,
    loading: false,
  }),
}));

const mockAlbum = {
  id: 2,
  title: "Another Album",
  artist: { name: "Another Artist", lettercode: "AA", numbercode: 2, genre: "Jazz" },
  entry: 43,
  format: "Vinyl",
  label: "Another Label",
  add_date: "2024-02-01",
  plays: 5,
};

describe("RemoveFromBin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render an icon button", () => {
    render(<RemoveFromBin album={mockAlbum} />);
    expect(screen.getByRole("button")).toBeInTheDocument();
  });

  it("should call deleteFromBin when clicked", () => {
    render(<RemoveFromBin album={mockAlbum} />);
    const button = screen.getByRole("button");
    fireEvent.click(button);
    expect(mockDeleteFromBin).toHaveBeenCalledWith(2);
  });

  it("should render Unarchive icon", () => {
    const { container } = render(<RemoveFromBin album={mockAlbum} />);
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("should have warning color by default", () => {
    render(<RemoveFromBin album={mockAlbum} />);
    const button = screen.getByRole("button");
    expect(button).toHaveClass("MuiIconButton-colorWarning");
  });
});
