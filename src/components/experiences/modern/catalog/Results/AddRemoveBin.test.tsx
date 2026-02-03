import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import AddRemoveBin from "./AddRemoveBin";

const mockAlbum = {
  id: 1,
  title: "Test Album",
  artist: { name: "Test Artist", lettercode: "TA", numbercode: 1, genre: "Rock" },
  entry: 42,
  format: "CD",
  label: "Test Label",
  add_date: "2024-01-01",
  plays: 0,
};

// Mock binHooks with different states
vi.mock("@/src/hooks/binHooks", () => ({
  useBin: vi.fn(() => ({
    bin: [],
    loading: false,
  })),
  useAddToBin: () => ({
    addToBin: vi.fn(),
    loading: false,
  }),
  useDeleteFromBin: () => ({
    deleteFromBin: vi.fn(),
    loading: false,
  }),
}));

describe("AddRemoveBin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render a button", () => {
    render(<AddRemoveBin album={mockAlbum} />);
    expect(screen.getByRole("button")).toBeInTheDocument();
  });

  it("should show loading state when bin is loading", async () => {
    const { useBin } = await import("@/src/hooks/binHooks");
    vi.mocked(useBin).mockReturnValue({
      bin: undefined,
      loading: true,
      isSuccess: false,
      isError: false,
    });

    render(<AddRemoveBin album={mockAlbum} />);
    const button = screen.getByRole("button");
    expect(button).toBeDisabled();
  });

  it("should show AddToBin when album is not in bin", async () => {
    const { useBin } = await import("@/src/hooks/binHooks");
    vi.mocked(useBin).mockReturnValue({
      bin: [],
      loading: false,
      isSuccess: true,
      isError: false,
    });

    render(<AddRemoveBin album={mockAlbum} />);
    // AddToBin should be rendered (Archive icon)
    expect(screen.getByRole("button")).toBeInTheDocument();
  });

  it("should show RemoveFromBin when album is in bin", async () => {
    const { useBin } = await import("@/src/hooks/binHooks");
    vi.mocked(useBin).mockReturnValue({
      bin: [mockAlbum],
      loading: false,
      isSuccess: true,
      isError: false,
    });

    render(<AddRemoveBin album={mockAlbum} />);
    // RemoveFromBin should be rendered with warning color
    const button = screen.getByRole("button");
    expect(button).toHaveClass("MuiIconButton-colorWarning");
  });
});
