import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import BinContent from "./BinContent";
import type { AlbumEntry } from "@/lib/features/catalog/types";

// Mock the hooks
const mockUseBin = vi.fn();
const mockUseGetRightbarQuery = vi.fn();

vi.mock("@/src/hooks/binHooks", () => ({
  useBin: () => mockUseBin(),
}));

vi.mock("@/lib/features/application/api", () => ({
  useGetRightbarQuery: () => mockUseGetRightbarQuery(),
}));

// Mock child components
vi.mock("../RightBarContentContainer", () => ({
  default: ({
    label,
    startDecorator,
    children,
  }: {
    label: string;
    startDecorator: React.ReactNode;
    children: React.ReactNode;
  }) => (
    <div data-testid="content-container">
      <span data-testid="container-label">{label}</span>
      <span data-testid="start-decorator">{startDecorator}</span>
      {children}
    </div>
  ),
}));

vi.mock("./BinEntry", () => ({
  default: ({ entry }: { entry: AlbumEntry }) => (
    <div data-testid={`bin-entry-${entry.id}`}>{entry.title}</div>
  ),
}));

// Mock MUI components
vi.mock("@mui/icons-material", () => ({
  Inbox: () => <svg data-testid="inbox-icon" />,
}));

vi.mock("@mui/joy", () => ({
  Card: ({
    children,
    variant,
    sx,
  }: {
    children: React.ReactNode;
    variant?: string;
    sx?: any;
  }) => (
    <div data-testid="card" data-variant={variant} style={{ height: sx?.height }}>
      {children}
    </div>
  ),
  Divider: () => <hr data-testid="bin-divider" />,
  Skeleton: ({ variant, sx }: { variant?: string; sx?: any }) => (
    <div
      data-testid="skeleton"
      data-variant={variant}
      style={{ height: sx?.height }}
    />
  ),
  Typography: ({
    children,
    level,
  }: {
    children: React.ReactNode;
    level?: string;
  }) => (
    <span data-testid="typography" data-level={level}>
      {children}
    </span>
  ),
}));

describe("BinContent", () => {
  const mockBinEntries: AlbumEntry[] = [
    {
      id: 1,
      title: "Album One",
      entry: 1,
      format: "CD",
      artist: {
        name: "Artist One",
        lettercode: "AO",
        numbercode: 1,
        genre: "Rock",
        id: 1,
      },
      label: "Label One",
      add_date: "2024-01-01",
      alternate_artist: undefined,
      play_freq: undefined,
      rotation_id: undefined,
      plays: undefined,
    },
    {
      id: 2,
      title: "Album Two",
      entry: 2,
      format: "Vinyl",
      artist: {
        name: "Artist Two",
        lettercode: "AT",
        numbercode: 2,
        genre: "Jazz",
        id: 2,
      },
      label: "Label Two",
      add_date: "2024-01-02",
      alternate_artist: undefined,
      play_freq: undefined,
      rotation_id: undefined,
      plays: undefined,
    },
    {
      id: 3,
      title: "Album Three",
      entry: 3,
      format: "CD",
      artist: {
        name: "Artist Three",
        lettercode: "ATH",
        numbercode: 3,
        genre: "Electronic",
        id: 3,
      },
      label: "Label Three",
      add_date: "2024-01-03",
      alternate_artist: undefined,
      play_freq: undefined,
      rotation_id: undefined,
      plays: undefined,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseBin.mockReturnValue({
      bin: mockBinEntries,
      loading: false,
      isSuccess: true,
      isError: false,
    });
    mockUseGetRightbarQuery.mockReturnValue({
      data: false,
    });
  });

  it("should render the content container with Mail Bin label", () => {
    render(<BinContent />);

    expect(screen.getByTestId("content-container")).toBeInTheDocument();
    expect(screen.getByTestId("container-label")).toHaveTextContent("Mail Bin");
  });

  it("should render inbox icon in start decorator", () => {
    render(<BinContent />);

    expect(screen.getByTestId("inbox-icon")).toBeInTheDocument();
  });

  it("should render skeleton when loading", () => {
    mockUseBin.mockReturnValue({
      bin: undefined,
      loading: true,
      isSuccess: false,
      isError: false,
    });

    render(<BinContent />);

    expect(screen.getByTestId("skeleton")).toBeInTheDocument();
    expect(screen.getByTestId("skeleton")).toHaveAttribute(
      "data-variant",
      "rectangular"
    );
  });

  it("should render card when not loading", () => {
    render(<BinContent />);

    expect(screen.getByTestId("card")).toBeInTheDocument();
    expect(screen.getByTestId("card")).toHaveAttribute(
      "data-variant",
      "outlined"
    );
  });

  it("should render empty message when bin is empty", () => {
    mockUseBin.mockReturnValue({
      bin: [],
      loading: false,
      isSuccess: true,
      isError: false,
    });

    render(<BinContent />);

    expect(screen.getByText("An empty record...")).toBeInTheDocument();
  });

  it("should render empty message when bin is null", () => {
    mockUseBin.mockReturnValue({
      bin: null,
      loading: false,
      isSuccess: true,
      isError: false,
    });

    render(<BinContent />);

    expect(screen.getByText("An empty record...")).toBeInTheDocument();
  });

  it("should render empty message when isError is true", () => {
    mockUseBin.mockReturnValue({
      bin: mockBinEntries,
      loading: false,
      isSuccess: true,
      isError: true,
    });

    render(<BinContent />);

    expect(screen.getByText("An empty record...")).toBeInTheDocument();
  });

  it("should render bin entries when bin has items", () => {
    render(<BinContent />);

    expect(screen.getByTestId("bin-entry-1")).toBeInTheDocument();
    expect(screen.getByTestId("bin-entry-2")).toBeInTheDocument();
    expect(screen.getByTestId("bin-entry-3")).toBeInTheDocument();
  });

  it("should render entry titles", () => {
    render(<BinContent />);

    expect(screen.getByText("Album One")).toBeInTheDocument();
    expect(screen.getByText("Album Two")).toBeInTheDocument();
    expect(screen.getByText("Album Three")).toBeInTheDocument();
  });

  it("should render dividers between entries", () => {
    render(<BinContent />);

    // Should have dividers between entries (n-1 dividers for n entries)
    const dividers = screen.getAllByTestId("bin-divider");
    expect(dividers.length).toBe(mockBinEntries.length - 1);
  });

  it("should not render divider after last entry", () => {
    render(<BinContent />);

    const dividers = screen.getAllByTestId("bin-divider");
    // Should be 2 dividers for 3 entries (no divider after last)
    expect(dividers.length).toBe(2);
  });

  it("should use default height when max is false", () => {
    mockUseGetRightbarQuery.mockReturnValue({
      data: false,
    });

    render(<BinContent />);

    const card = screen.getByTestId("card");
    expect(card).toHaveStyle({ height: "335px" });
  });

  it("should use taller height when max is true", () => {
    mockUseGetRightbarQuery.mockReturnValue({
      data: true,
    });

    render(<BinContent />);

    const card = screen.getByTestId("card");
    expect(card).toHaveStyle({ height: "500px" });
  });

  it("should use default height when max is undefined", () => {
    mockUseGetRightbarQuery.mockReturnValue({
      data: undefined,
    });

    render(<BinContent />);

    const card = screen.getByTestId("card");
    expect(card).toHaveStyle({ height: "335px" });
  });

  it("should render skeleton with correct height when loading and max is false", () => {
    mockUseBin.mockReturnValue({
      bin: undefined,
      loading: true,
      isSuccess: false,
      isError: false,
    });
    mockUseGetRightbarQuery.mockReturnValue({
      data: false,
    });

    render(<BinContent />);

    const skeleton = screen.getByTestId("skeleton");
    expect(skeleton).toHaveStyle({ height: "335px" });
  });

  it("should render skeleton with taller height when loading and max is true", () => {
    mockUseBin.mockReturnValue({
      bin: undefined,
      loading: true,
      isSuccess: false,
      isError: false,
    });
    mockUseGetRightbarQuery.mockReturnValue({
      data: true,
    });

    render(<BinContent />);

    const skeleton = screen.getByTestId("skeleton");
    expect(skeleton).toHaveStyle({ height: "500px" });
  });

  it("should render single entry without divider", () => {
    mockUseBin.mockReturnValue({
      bin: [mockBinEntries[0]],
      loading: false,
      isSuccess: true,
      isError: false,
    });

    render(<BinContent />);

    expect(screen.getByTestId("bin-entry-1")).toBeInTheDocument();
    expect(screen.queryByTestId("bin-divider")).not.toBeInTheDocument();
  });

  it("should render two entries with one divider", () => {
    mockUseBin.mockReturnValue({
      bin: [mockBinEntries[0], mockBinEntries[1]],
      loading: false,
      isSuccess: true,
      isError: false,
    });

    render(<BinContent />);

    expect(screen.getByTestId("bin-entry-1")).toBeInTheDocument();
    expect(screen.getByTestId("bin-entry-2")).toBeInTheDocument();
    expect(screen.getAllByTestId("bin-divider")).toHaveLength(1);
  });

  it("should handle entries with same ids correctly using index in key", () => {
    const duplicateIdEntries = [
      { ...mockBinEntries[0], id: 1 },
      { ...mockBinEntries[1], id: 1 }, // Same id but different entry
    ];

    mockUseBin.mockReturnValue({
      bin: duplicateIdEntries,
      loading: false,
      isSuccess: true,
      isError: false,
    });

    render(<BinContent />);

    // Should render both entries even with same id (index is used in key)
    expect(screen.getAllByTestId("bin-entry-1")).toHaveLength(2);
  });

  it("should show empty message with typography body-md level", () => {
    mockUseBin.mockReturnValue({
      bin: [],
      loading: false,
      isSuccess: true,
      isError: false,
    });

    render(<BinContent />);

    const typography = screen.getByTestId("typography");
    expect(typography).toHaveAttribute("data-level", "body-md");
  });
});
