import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import BinContent from "./BinContent";
import type { AlbumEntry } from "@/lib/features/catalog/types";

// Mock the hooks
const mockUseBin = vi.fn();
const mockUseGetRightbarQuery = vi.fn();

vi.mock("@/src/hooks/binHooks", () => ({
  useBin: () => mockUseBin(),
  useDeleteFromBin: () => ({ deleteFromBin: vi.fn() }),
}));

vi.mock("@/lib/features/application/api", () => ({
  useGetRightbarQuery: () => mockUseGetRightbarQuery(),
}));

vi.mock("@/src/hooks/flowsheetHooks", () => ({
  useShowControl: () => ({ live: false }),
  // Hoisted once here (not per row) so the rows can stay hook-free.
  useQueue: () => ({ addToQueue: vi.fn() }),
  useFlowsheet: () => ({ addToFlowsheet: vi.fn(() => Promise.resolve()) }),
}));

// Mock child components
vi.mock("../RightBarContentContainer", () => ({
  default: ({
    label,
    startDecorator,
    endDecorator,
    children,
  }: {
    label: string;
    startDecorator: React.ReactNode;
    endDecorator?: React.ReactNode;
    children: React.ReactNode;
  }) => (
    <div data-testid="content-container">
      <span data-testid="container-label">{label}</span>
      <span data-testid="start-decorator">{startDecorator}</span>
      <span data-testid="end-decorator">{endDecorator}</span>
      {children}
    </div>
  ),
}));

vi.mock("./BinEntry", () => ({
  default: ({ entry }: { entry: AlbumEntry }) => (
    <div data-testid={`bin-entry-${entry.id}`}>{entry.title}</div>
  ),
}));

vi.mock("./ClearBinButton", () => ({
  default: ({ count }: { count: number }) => (
    <button data-testid="clear-bin-button">clear-{count}</button>
  ),
}));

vi.mock("./ExportBinButton", () => ({
  default: ({ entries }: { entries: AlbumEntry[] }) => (
    <button data-testid="export-bin-button">export-{entries.length}</button>
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
    <div
      data-testid="card"
      data-variant={variant}
      data-overflow-y={sx?.overflowY}
      data-flex={sx?.flex}
      data-min-height={sx?.minHeight}
      style={{ height: sx?.height }}
    >
      {children}
    </div>
  ),
  Divider: () => <hr data-testid="bin-divider" />,
  Stack: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="stack">{children}</div>
  ),
  Skeleton: ({ variant, sx }: { variant?: string; sx?: any }) => (
    <div
      data-testid="skeleton"
      data-variant={variant}
      data-flex={sx?.flex}
      data-min-height={sx?.minHeight}
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
      rotation_bin: undefined,
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
      rotation_bin: undefined,
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
      rotation_bin: undefined,
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
    mockUseGetRightbarQuery.mockReturnValue({ data: false });
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

  it("should fill the leftover column height and scroll on overflow (auto)", () => {
    render(<BinContent />);

    const card = screen.getByTestId("card");
    expect(card).toHaveAttribute("data-flex", "1");
    expect(card).toHaveAttribute("data-min-height", "0");
    expect(card).toHaveAttribute("data-overflow-y", "auto");
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

  it("should render the Clear Mail Bin button with the entry count when non-empty", () => {
    render(<BinContent />);

    expect(screen.getByTestId("clear-bin-button")).toHaveTextContent("clear-3");
  });

  it("should not render the Clear Mail Bin button when empty", () => {
    mockUseBin.mockReturnValue({
      bin: [],
      loading: false,
      isSuccess: true,
      isError: false,
    });

    render(<BinContent />);

    expect(screen.queryByTestId("clear-bin-button")).not.toBeInTheDocument();
  });

  it("should not render the Clear Mail Bin button on error", () => {
    mockUseBin.mockReturnValue({
      bin: mockBinEntries,
      loading: false,
      isSuccess: true,
      isError: true,
    });

    render(<BinContent />);

    expect(screen.queryByTestId("clear-bin-button")).not.toBeInTheDocument();
  });

  it("should render skeleton that fills the leftover column height when loading", () => {
    mockUseBin.mockReturnValue({
      bin: undefined,
      loading: true,
      isSuccess: false,
      isError: false,
    });

    render(<BinContent />);

    const skeleton = screen.getByTestId("skeleton");
    expect(skeleton).toHaveAttribute("data-flex", "1");
    expect(skeleton).toHaveAttribute("data-min-height", "0");
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
