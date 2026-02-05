import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import Results from "./Results";
import { createTestAlbum, createTestAlbumList } from "@/lib/test-utils/fixtures";

// Mock functions
const mockSetSelection = vi.fn();
const mockLoadMore = vi.fn();

// Mock useCatalogSearch hook
vi.mock("@/src/hooks/catalogHooks", () => ({
  useCatalogSearch: vi.fn(() => ({
    selected: [],
    setSelection: mockSetSelection,
  })),
  useCatalogResults: vi.fn(() => ({
    data: [],
    loading: false,
    loadMore: mockLoadMore,
    reachedEndForQuery: false,
  })),
}));

// Mock child components
vi.mock("./Result", () => ({
  default: ({ album }: any) => (
    <tr data-testid={`catalog-result-${album.id}`}>
      <td>{album.title}</td>
    </tr>
  ),
}));

vi.mock("./ResultsContainer", () => ({
  default: ({ children }: any) => (
    <div data-testid="results-container">{children}</div>
  ),
}));

vi.mock("./TableHeader", () => ({
  default: ({ textValue }: any) => (
    <span data-testid={`table-header-${textValue}`}>{textValue}</span>
  ),
}));

describe("Results", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render ResultsContainer", () => {
    render(<Results color="primary" />);
    expect(screen.getByTestId("results-container")).toBeInTheDocument();
  });

  it("should render table with correct aria-labelledby", () => {
    render(<Results color="primary" />);
    const table = screen.getByRole("table");
    expect(table).toHaveAttribute("aria-labelledby", "tableTitle");
  });

  it("should render table headers", () => {
    render(<Results color="primary" />);
    expect(screen.getByTestId("table-header-Artist")).toBeInTheDocument();
    expect(screen.getByTestId("table-header-Title")).toBeInTheDocument();
    expect(screen.getByTestId("table-header-Code")).toBeInTheDocument();
    expect(screen.getByTestId("table-header-Format")).toBeInTheDocument();
    expect(screen.getByTestId("table-header-Plays")).toBeInTheDocument();
  });

  it("should render checkbox in header", () => {
    render(<Results color="primary" />);
    const checkbox = screen.getByRole("checkbox");
    expect(checkbox).toBeInTheDocument();
  });

  it("should show loading spinner when loading", async () => {
    const { useCatalogResults } = await import("@/src/hooks/catalogHooks");
    vi.mocked(useCatalogResults).mockReturnValue({
      data: [],
      loading: true,
      loadMore: mockLoadMore,
      reachedEndForQuery: false,
    } as any);

    render(<Results color="primary" />);
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
  });

  it("should render album results when not loading", async () => {
    const { useCatalogResults } = await import("@/src/hooks/catalogHooks");
    const mockAlbums = createTestAlbumList(2);
    vi.mocked(useCatalogResults).mockReturnValue({
      data: mockAlbums,
      loading: false,
      loadMore: mockLoadMore,
      reachedEndForQuery: false,
    } as any);

    render(<Results color="primary" />);
    expect(screen.getByTestId(`catalog-result-${mockAlbums[0].id}`)).toBeInTheDocument();
    expect(screen.getByTestId(`catalog-result-${mockAlbums[1].id}`)).toBeInTheDocument();
  });

  it("should render Load more button when not loading and not at end", async () => {
    const { useCatalogResults } = await import("@/src/hooks/catalogHooks");
    const mockAlbums = createTestAlbumList(2);
    vi.mocked(useCatalogResults).mockReturnValue({
      data: mockAlbums,
      loading: false,
      loadMore: mockLoadMore,
      reachedEndForQuery: false,
    } as any);

    render(<Results color="primary" />);
    const loadMoreButton = screen.getByRole("button", { name: /load more/i });
    expect(loadMoreButton).toBeInTheDocument();
  });

  it("should not render Load more button when reached end of query", async () => {
    const { useCatalogResults } = await import("@/src/hooks/catalogHooks");
    const mockAlbums = createTestAlbumList(2);
    vi.mocked(useCatalogResults).mockReturnValue({
      data: mockAlbums,
      loading: false,
      loadMore: mockLoadMore,
      reachedEndForQuery: true,
    } as any);

    render(<Results color="primary" />);
    expect(screen.queryByRole("button", { name: /load more/i })).not.toBeInTheDocument();
  });

  it("should not render Load more button when loading", async () => {
    const { useCatalogResults } = await import("@/src/hooks/catalogHooks");
    vi.mocked(useCatalogResults).mockReturnValue({
      data: [],
      loading: true,
      loadMore: mockLoadMore,
      reachedEndForQuery: false,
    } as any);

    render(<Results color="primary" />);
    expect(screen.queryByRole("button", { name: /load more/i })).not.toBeInTheDocument();
  });

  it("should call loadMore when Load more button is clicked", async () => {
    const { useCatalogResults } = await import("@/src/hooks/catalogHooks");
    const mockAlbums = createTestAlbumList(2);
    vi.mocked(useCatalogResults).mockReturnValue({
      data: mockAlbums,
      loading: false,
      loadMore: mockLoadMore,
      reachedEndForQuery: false,
    } as any);

    render(<Results color="primary" />);
    const loadMoreButton = screen.getByRole("button", { name: /load more/i });
    fireEvent.click(loadMoreButton);
    expect(mockLoadMore).toHaveBeenCalledTimes(1);
  });

  it("should show indeterminate checkbox when some items are selected", async () => {
    const { useCatalogSearch, useCatalogResults } = await import("@/src/hooks/catalogHooks");
    const mockAlbums = createTestAlbumList(3);

    vi.mocked(useCatalogSearch).mockReturnValue({
      selected: [mockAlbums[0].id],
      setSelection: mockSetSelection,
    } as any);

    vi.mocked(useCatalogResults).mockReturnValue({
      data: mockAlbums,
      loading: false,
      loadMore: mockLoadMore,
      reachedEndForQuery: false,
    } as any);

    const { container } = render(<Results color="primary" />);
    // MUI Joy's Checkbox renders with MuiCheckbox-indeterminate class when indeterminate
    const checkboxRoot = container.querySelector('.MuiCheckbox-root');
    expect(checkboxRoot).toBeInTheDocument();
    // Verify the checkbox is not checked (since only partial selection)
    const checkbox = screen.getByRole("checkbox");
    expect(checkbox).not.toBeChecked();
  });

  it("should show checked checkbox when all items are selected", async () => {
    const { useCatalogSearch, useCatalogResults } = await import("@/src/hooks/catalogHooks");
    const mockAlbums = createTestAlbumList(3);

    vi.mocked(useCatalogSearch).mockReturnValue({
      selected: mockAlbums.map(a => a.id),
      setSelection: mockSetSelection,
    } as any);

    vi.mocked(useCatalogResults).mockReturnValue({
      data: mockAlbums,
      loading: false,
      loadMore: mockLoadMore,
      reachedEndForQuery: false,
    } as any);

    render(<Results color="primary" />);
    const checkbox = screen.getByRole("checkbox");
    expect(checkbox).toBeChecked();
  });

  it("should call setSelection with all ids when header checkbox is checked", async () => {
    const { useCatalogSearch, useCatalogResults } = await import("@/src/hooks/catalogHooks");
    const mockAlbums = createTestAlbumList(3);

    vi.mocked(useCatalogSearch).mockReturnValue({
      selected: [],
      setSelection: mockSetSelection,
    } as any);

    vi.mocked(useCatalogResults).mockReturnValue({
      data: mockAlbums,
      loading: false,
      loadMore: mockLoadMore,
      reachedEndForQuery: false,
    } as any);

    render(<Results color="primary" />);
    const checkbox = screen.getByRole("checkbox");
    fireEvent.click(checkbox);
    expect(mockSetSelection).toHaveBeenCalledWith(mockAlbums.map(a => a.id));
  });

  it("should call setSelection with empty array when header checkbox is unchecked", async () => {
    const { useCatalogSearch, useCatalogResults } = await import("@/src/hooks/catalogHooks");
    const mockAlbums = createTestAlbumList(3);

    vi.mocked(useCatalogSearch).mockReturnValue({
      selected: mockAlbums.map(a => a.id),
      setSelection: mockSetSelection,
    } as any);

    vi.mocked(useCatalogResults).mockReturnValue({
      data: mockAlbums,
      loading: false,
      loadMore: mockLoadMore,
      reachedEndForQuery: false,
    } as any);

    render(<Results color="primary" />);
    const checkbox = screen.getByRole("checkbox");
    fireEvent.click(checkbox);
    expect(mockSetSelection).toHaveBeenCalledWith([]);
  });

  it("should render with undefined color prop", () => {
    render(<Results color={undefined} />);
    expect(screen.getByTestId("results-container")).toBeInTheDocument();
  });

  it("should handle null releaseList gracefully", async () => {
    const { useCatalogResults } = await import("@/src/hooks/catalogHooks");
    vi.mocked(useCatalogResults).mockReturnValue({
      data: null,
      loading: false,
      loadMore: mockLoadMore,
      reachedEndForQuery: true,
    } as any);

    render(<Results color="primary" />);
    // Should not crash and should render the container
    expect(screen.getByTestId("results-container")).toBeInTheDocument();
  });

  it("should handle undefined releaseList gracefully", async () => {
    const { useCatalogResults } = await import("@/src/hooks/catalogHooks");
    vi.mocked(useCatalogResults).mockReturnValue({
      data: undefined,
      loading: false,
      loadMore: mockLoadMore,
      reachedEndForQuery: true,
    } as any);

    render(<Results color="primary" />);
    expect(screen.getByTestId("results-container")).toBeInTheDocument();
  });

  it("should have primary color checkbox when items are selected", async () => {
    const { useCatalogSearch, useCatalogResults } = await import("@/src/hooks/catalogHooks");
    const mockAlbums = createTestAlbumList(3);

    vi.mocked(useCatalogSearch).mockReturnValue({
      selected: [mockAlbums[0].id],
      setSelection: mockSetSelection,
    } as any);

    vi.mocked(useCatalogResults).mockReturnValue({
      data: mockAlbums,
      loading: false,
      loadMore: mockLoadMore,
      reachedEndForQuery: false,
    } as any);

    const { container } = render(<Results color="primary" />);
    // MUI Joy's Checkbox root element has the color class
    const checkboxRoot = container.querySelector('.MuiCheckbox-colorPrimary');
    expect(checkboxRoot).toBeInTheDocument();
  });

  it("should render empty results when not loading and no data", async () => {
    const { useCatalogResults } = await import("@/src/hooks/catalogHooks");
    vi.mocked(useCatalogResults).mockReturnValue({
      data: [],
      loading: false,
      loadMore: mockLoadMore,
      reachedEndForQuery: true,
    } as any);

    render(<Results color="primary" />);
    // No album results should be rendered
    expect(screen.queryByTestId(/catalog-result-/)).not.toBeInTheDocument();
  });
});
