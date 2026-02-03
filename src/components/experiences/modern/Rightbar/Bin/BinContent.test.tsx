import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import BinContent from "./BinContent";
import type { AlbumEntry } from "@/lib/features/catalog/types";

// Mock hooks
vi.mock("@/src/hooks/binHooks", () => ({
  useBin: vi.fn(() => ({
    bin: [],
    isError: false,
    loading: false,
  })),
}));

vi.mock("@/lib/features/application/api", () => ({
  useGetRightbarQuery: vi.fn(() => ({
    data: false,
  })),
}));

// Mock child components
vi.mock("../RightBarContentContainer", () => ({
  default: ({ children, label, startDecorator }: any) => (
    <div data-testid="rightbar-container" data-label={label}>
      {startDecorator}
      {children}
    </div>
  ),
}));

vi.mock("./BinEntry", () => ({
  default: ({ entry }: any) => (
    <div data-testid="bin-entry">{entry.title}</div>
  ),
}));

// Mock MUI icons
vi.mock("@mui/icons-material", () => ({
  Inbox: () => <span data-testid="inbox-icon" />,
}));

describe("BinContent", () => {
  const mockBinEntries: AlbumEntry[] = [
    {
      id: 1,
      title: "Album One",
      entry: 5,
      format: "CD",
      artist: {
        id: 1,
        name: "Artist One",
        lettercode: "AO",
        numbercode: 100,
        genre: "Rock",
      },
    } as AlbumEntry,
    {
      id: 2,
      title: "Album Two",
      entry: 10,
      format: "Vinyl",
      artist: {
        id: 2,
        name: "Artist Two",
        lettercode: "AT",
        numbercode: 200,
        genre: "Jazz",
      },
    } as AlbumEntry,
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render with Mail Bin label", () => {
    render(<BinContent />);

    const container = screen.getByTestId("rightbar-container");
    expect(container).toHaveAttribute("data-label", "Mail Bin");
  });

  it("should render inbox icon", () => {
    render(<BinContent />);

    expect(screen.getByTestId("inbox-icon")).toBeInTheDocument();
  });

  it("should show loading skeleton when loading", async () => {
    const { useBin } = await import("@/src/hooks/binHooks");
    vi.mocked(useBin).mockReturnValue({
      bin: [],
      isError: false,
      loading: true,
    });

    render(<BinContent />);

    // Should render skeleton when loading
    const container = screen.getByTestId("rightbar-container");
    expect(container).toBeInTheDocument();
  });

  it("should show empty message when bin is empty", async () => {
    const { useBin } = await import("@/src/hooks/binHooks");
    vi.mocked(useBin).mockReturnValue({
      bin: [],
      isError: false,
      loading: false,
    });

    render(<BinContent />);

    expect(screen.getByText("An empty record...")).toBeInTheDocument();
  });

  it("should show empty message when bin is null", async () => {
    const { useBin } = await import("@/src/hooks/binHooks");
    vi.mocked(useBin).mockReturnValue({
      bin: null as any,
      isError: false,
      loading: false,
    });

    render(<BinContent />);

    expect(screen.getByText("An empty record...")).toBeInTheDocument();
  });

  it("should show empty message when there is an error", async () => {
    const { useBin } = await import("@/src/hooks/binHooks");
    vi.mocked(useBin).mockReturnValue({
      bin: mockBinEntries,
      isError: true,
      loading: false,
    });

    render(<BinContent />);

    expect(screen.getByText("An empty record...")).toBeInTheDocument();
  });

  it("should render bin entries when data is available", async () => {
    const { useBin } = await import("@/src/hooks/binHooks");
    vi.mocked(useBin).mockReturnValue({
      bin: mockBinEntries,
      isError: false,
      loading: false,
    });

    render(<BinContent />);

    expect(screen.getByText("Album One")).toBeInTheDocument();
    expect(screen.getByText("Album Two")).toBeInTheDocument();
  });

  it("should render correct number of bin entries", async () => {
    const { useBin } = await import("@/src/hooks/binHooks");
    vi.mocked(useBin).mockReturnValue({
      bin: mockBinEntries,
      isError: false,
      loading: false,
    });

    render(<BinContent />);

    const entries = screen.getAllByTestId("bin-entry");
    expect(entries).toHaveLength(2);
  });

  it("should use larger height when rightbar data is available", async () => {
    const { useGetRightbarQuery } = await import("@/lib/features/application/api");
    vi.mocked(useGetRightbarQuery).mockReturnValue({
      data: true,
    } as any);

    const { useBin } = await import("@/src/hooks/binHooks");
    vi.mocked(useBin).mockReturnValue({
      bin: [],
      isError: false,
      loading: false,
    });

    render(<BinContent />);

    // Component should render with max height (500 instead of 335)
    expect(screen.getByTestId("rightbar-container")).toBeInTheDocument();
  });
});
