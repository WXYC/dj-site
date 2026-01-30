import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import RemoveFromBin from "./RemoveFromBin";
import { createTestAlbum } from "@/lib/test-utils/fixtures";

const mockDeleteFromBin = vi.fn();

vi.mock("@/src/hooks/binHooks", () => ({
  useDeleteFromBin: () => ({
    deleteFromBin: mockDeleteFromBin,
    loading: false,
  }),
}));

const mockAlbum = createTestAlbum({ id: 2 });

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
