import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import AddRemoveBin from "./AddRemoveBin";
import { createTestAlbum } from "@/lib/test-utils/fixtures";
import type { AlbumEntry } from "@/lib/features/catalog/types";

// Mock hooks
const mockBin: AlbumEntry[] = [];

vi.mock("@/src/hooks/binHooks", () => ({
  useBin: vi.fn(() => ({
    bin: mockBin,
    loading: false,
  })),
}));

// Mock child components
vi.mock("./AddToBin", () => ({
  default: ({ album }: any) => (
    <button data-testid="add-to-bin">{album.title}</button>
  ),
}));

vi.mock("./RemoveFromBin", () => ({
  default: ({ album }: any) => (
    <button data-testid="remove-from-bin">{album.title}</button>
  ),
}));

// Mock MUI icons
vi.mock("@mui/icons-material", () => ({
  Archive: () => <span data-testid="archive-icon" />,
}));

describe("AddRemoveBin", () => {
  const mockAlbum = createTestAlbum({ id: 1 });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render loading button when loading", async () => {
    const { useBin } = await import("@/src/hooks/binHooks");
    vi.mocked(useBin).mockReturnValue({
      bin: [],
      loading: true,
      isSuccess: false,
      isError: false,
    });

    render(<AddRemoveBin album={mockAlbum} />);

    const button = screen.getByRole("button");
    expect(button).toBeDisabled();
  });

  it("should render loading button when bin is null", async () => {
    const { useBin } = await import("@/src/hooks/binHooks");
    vi.mocked(useBin).mockReturnValue({
      bin: null,
      loading: false,
      isSuccess: false,
      isError: false,
    } as any);

    render(<AddRemoveBin album={mockAlbum} />);

    const button = screen.getByRole("button");
    expect(button).toBeDisabled();
  });

  it("should render loading button when bin is undefined", async () => {
    const { useBin } = await import("@/src/hooks/binHooks");
    vi.mocked(useBin).mockReturnValue({
      bin: undefined,
      loading: false,
      isSuccess: false,
      isError: false,
    } as any);

    render(<AddRemoveBin album={mockAlbum} />);

    const button = screen.getByRole("button");
    expect(button).toBeDisabled();
  });

  it("should render loading indicator when loading", async () => {
    const { useBin } = await import("@/src/hooks/binHooks");
    vi.mocked(useBin).mockReturnValue({
      bin: [],
      loading: true,
      isSuccess: false,
      isError: false,
    });

    render(<AddRemoveBin album={mockAlbum} />);
    // MUI Joy shows loading indicator (CircularProgress) instead of Archive icon
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
  });

  it("should render AddToBin when album is not in bin", async () => {
    const { useBin } = await import("@/src/hooks/binHooks");
    vi.mocked(useBin).mockReturnValue({
      bin: [],
      loading: false,
      isSuccess: true,
      isError: false,
    });

    render(<AddRemoveBin album={mockAlbum} />);
    expect(screen.getByTestId("add-to-bin")).toBeInTheDocument();
  });

  it("should render RemoveFromBin when album is in bin", async () => {
    const { useBin } = await import("@/src/hooks/binHooks");
    const albumInBin = createTestAlbum({ id: 1 });
    vi.mocked(useBin).mockReturnValue({
      bin: [albumInBin],
      loading: false,
      isSuccess: true,
      isError: false,
    });

    render(<AddRemoveBin album={mockAlbum} />);
    expect(screen.getByTestId("remove-from-bin")).toBeInTheDocument();
  });

  it("should render AddToBin when different album is in bin", async () => {
    const { useBin } = await import("@/src/hooks/binHooks");
    const differentAlbum = createTestAlbum({ id: 999 });
    vi.mocked(useBin).mockReturnValue({
      bin: [differentAlbum],
      loading: false,
      isSuccess: true,
      isError: false,
    });

    render(<AddRemoveBin album={mockAlbum} />);
    expect(screen.getByTestId("add-to-bin")).toBeInTheDocument();
  });

  it("should pass album prop to AddToBin", async () => {
    const { useBin } = await import("@/src/hooks/binHooks");
    vi.mocked(useBin).mockReturnValue({
      bin: [],
      loading: false,
      isSuccess: true,
      isError: false,
    });

    render(<AddRemoveBin album={mockAlbum} />);
    expect(screen.getByTestId("add-to-bin")).toHaveTextContent(mockAlbum.title);
  });

  it("should pass album prop to RemoveFromBin", async () => {
    const { useBin } = await import("@/src/hooks/binHooks");
    const albumInBin = createTestAlbum({ id: 1 });
    vi.mocked(useBin).mockReturnValue({
      bin: [albumInBin],
      loading: false,
      isSuccess: true,
      isError: false,
    });

    render(<AddRemoveBin album={mockAlbum} />);
    expect(screen.getByTestId("remove-from-bin")).toHaveTextContent(mockAlbum.title);
  });

  it("should handle bin with multiple albums where target is present", async () => {
    const { useBin } = await import("@/src/hooks/binHooks");
    const album1 = createTestAlbum({ id: 1 });
    const album2 = createTestAlbum({ id: 2 });
    const album3 = createTestAlbum({ id: 3 });

    vi.mocked(useBin).mockReturnValue({
      bin: [album1, album2, album3],
      loading: false,
      isSuccess: true,
      isError: false,
    });

    render(<AddRemoveBin album={mockAlbum} />);
    expect(screen.getByTestId("remove-from-bin")).toBeInTheDocument();
  });

  it("should handle bin with multiple albums where target is not present", async () => {
    const { useBin } = await import("@/src/hooks/binHooks");
    const album2 = createTestAlbum({ id: 2 });
    const album3 = createTestAlbum({ id: 3 });

    vi.mocked(useBin).mockReturnValue({
      bin: [album2, album3],
      loading: false,
      isSuccess: true,
      isError: false,
    });

    render(<AddRemoveBin album={mockAlbum} />);
    expect(screen.getByTestId("add-to-bin")).toBeInTheDocument();
  });

  it("should find album by id match in bin", async () => {
    const { useBin } = await import("@/src/hooks/binHooks");
    // Album with same id but potentially different other properties
    const albumInBinWithDifferentTitle = createTestAlbum({
      id: 1,
      title: "Different Title"
    });

    vi.mocked(useBin).mockReturnValue({
      bin: [albumInBinWithDifferentTitle],
      loading: false,
      isSuccess: true,
      isError: false,
    });

    render(<AddRemoveBin album={mockAlbum} />);
    // Should match by id, so should show RemoveFromBin
    expect(screen.getByTestId("remove-from-bin")).toBeInTheDocument();
  });

  it("should not find album when bin is empty", async () => {
    const { useBin } = await import("@/src/hooks/binHooks");
    vi.mocked(useBin).mockReturnValue({
      bin: [],
      loading: false,
      isSuccess: true,
      isError: false,
    });

    render(<AddRemoveBin album={mockAlbum} />);
    expect(screen.getByTestId("add-to-bin")).toBeInTheDocument();
    expect(screen.queryByTestId("remove-from-bin")).not.toBeInTheDocument();
  });
});
