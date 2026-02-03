import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import Results from "./Results";

// Mock catalogHooks
const mockSetSelection = vi.fn();
const mockLoadMore = vi.fn();

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
      <td>{album.artist}</td>
    </tr>
  ),
}));

vi.mock("./ResultsContainer", () => ({
  default: ({ children }: any) => (
    <div data-testid="results-container">{children}</div>
  ),
}));

vi.mock("./TableHeader", () => ({
  default: ({ textValue }: any) => <span data-testid={`header-${textValue}`}>{textValue}</span>,
}));

describe("Results", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render table headers", () => {
    render(<Results color="primary" />);

    expect(screen.getByTestId("header-Artist")).toBeInTheDocument();
    expect(screen.getByTestId("header-Title")).toBeInTheDocument();
    expect(screen.getByTestId("header-Code")).toBeInTheDocument();
    expect(screen.getByTestId("header-Format")).toBeInTheDocument();
    expect(screen.getByTestId("header-Plays")).toBeInTheDocument();
  });

  it("should render in ResultsContainer", () => {
    render(<Results color="primary" />);

    expect(screen.getByTestId("results-container")).toBeInTheDocument();
  });

  it("should show loading spinner when loading", async () => {
    const { useCatalogResults } = await import("@/src/hooks/catalogHooks");
    vi.mocked(useCatalogResults).mockReturnValue({
      data: [],
      loading: true,
      loadMore: mockLoadMore,
      reachedEndForQuery: false,
    });

    render(<Results color="primary" />);

    expect(screen.getByRole("progressbar")).toBeInTheDocument();
  });

  it("should render catalog results when data is loaded", async () => {
    const { useCatalogResults } = await import("@/src/hooks/catalogHooks");
    vi.mocked(useCatalogResults).mockReturnValue({
      data: [
        { id: 1, artist: "Test Artist 1" },
        { id: 2, artist: "Test Artist 2" },
      ],
      loading: false,
      loadMore: mockLoadMore,
      reachedEndForQuery: false,
    });

    render(<Results color="primary" />);

    expect(screen.getByTestId("catalog-result-1")).toBeInTheDocument();
    expect(screen.getByTestId("catalog-result-2")).toBeInTheDocument();
  });

  it("should show Load more button when not reached end", async () => {
    const { useCatalogResults } = await import("@/src/hooks/catalogHooks");
    vi.mocked(useCatalogResults).mockReturnValue({
      data: [{ id: 1, artist: "Test Artist" }],
      loading: false,
      loadMore: mockLoadMore,
      reachedEndForQuery: false,
    });

    render(<Results color="primary" />);

    expect(screen.getByRole("button", { name: /load more/i })).toBeInTheDocument();
  });

  it("should not show Load more button when reached end", async () => {
    const { useCatalogResults } = await import("@/src/hooks/catalogHooks");
    vi.mocked(useCatalogResults).mockReturnValue({
      data: [{ id: 1, artist: "Test Artist" }],
      loading: false,
      loadMore: mockLoadMore,
      reachedEndForQuery: true,
    });

    render(<Results color="primary" />);

    expect(screen.queryByRole("button", { name: /load more/i })).not.toBeInTheDocument();
  });

  it("should call loadMore when Load more button is clicked", async () => {
    const { useCatalogResults } = await import("@/src/hooks/catalogHooks");
    vi.mocked(useCatalogResults).mockReturnValue({
      data: [{ id: 1, artist: "Test Artist" }],
      loading: false,
      loadMore: mockLoadMore,
      reachedEndForQuery: false,
    });

    render(<Results color="primary" />);

    const loadMoreButton = screen.getByRole("button", { name: /load more/i });
    fireEvent.click(loadMoreButton);

    expect(mockLoadMore).toHaveBeenCalled();
  });

  it("should render select all checkbox", () => {
    render(<Results color="primary" />);

    const checkbox = screen.getByRole("checkbox");
    expect(checkbox).toBeInTheDocument();
  });

  it("should handle select all when checkbox is clicked", async () => {
    const { useCatalogResults } = await import("@/src/hooks/catalogHooks");
    vi.mocked(useCatalogResults).mockReturnValue({
      data: [
        { id: 1, artist: "Test 1" },
        { id: 2, artist: "Test 2" },
      ],
      loading: false,
      loadMore: mockLoadMore,
      reachedEndForQuery: true,
    });

    render(<Results color="primary" />);

    const checkbox = screen.getByRole("checkbox");
    fireEvent.click(checkbox);

    expect(mockSetSelection).toHaveBeenCalledWith([1, 2]);
  });

  it("should handle deselect all when checkbox is clicked and all are selected", async () => {
    const { useCatalogSearch, useCatalogResults } = await import("@/src/hooks/catalogHooks");
    vi.mocked(useCatalogSearch).mockReturnValue({
      selected: [1, 2],
      setSelection: mockSetSelection,
    });
    vi.mocked(useCatalogResults).mockReturnValue({
      data: [
        { id: 1, artist: "Test 1" },
        { id: 2, artist: "Test 2" },
      ],
      loading: false,
      loadMore: mockLoadMore,
      reachedEndForQuery: true,
    });

    render(<Results color="primary" />);

    const checkbox = screen.getByRole("checkbox");
    fireEvent.click(checkbox);

    expect(mockSetSelection).toHaveBeenCalledWith([]);
  });
});
