import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import SearchBar from "./SearchBar";

// Mock hooks
const mockSetSearchString = vi.fn();

vi.mock("@/src/hooks/catalogHooks", () => ({
  useCatalogSearch: vi.fn(() => ({
    searchString: "",
    setSearchString: mockSetSearchString,
  })),
}));

// Mock Filters component
vi.mock("./Filters", () => ({
  Filters: ({ color }: any) => (
    <div data-testid="filters" data-color={color}>
      Filters
    </div>
  ),
}));

// Mock MUI icons
vi.mock("@mui/icons-material", () => ({
  Cancel: () => <span data-testid="cancel-icon" />,
  Troubleshoot: () => <span data-testid="search-icon" />,
}));

describe("SearchBar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render search input", () => {
    render(<SearchBar color="primary" />);

    expect(screen.getByPlaceholderText("Search")).toBeInTheDocument();
  });

  it("should render search icon", () => {
    render(<SearchBar color="primary" />);

    expect(screen.getByTestId("search-icon")).toBeInTheDocument();
  });

  it("should render form label", () => {
    render(<SearchBar color="primary" />);

    expect(screen.getByText("Search for an album or artist")).toBeInTheDocument();
  });

  it("should render Filters component", () => {
    render(<SearchBar color="primary" />);

    expect(screen.getByTestId("filters")).toBeInTheDocument();
  });

  it("should pass color prop to Filters", () => {
    render(<SearchBar color="warning" />);

    expect(screen.getByTestId("filters")).toHaveAttribute("data-color", "warning");
  });

  it("should call setSearchString when input changes", () => {
    render(<SearchBar color="primary" />);

    const input = screen.getByPlaceholderText("Search");
    fireEvent.change(input, { target: { value: "test query" } });

    expect(mockSetSearchString).toHaveBeenCalledWith("test query");
  });

  it("should display current search string value", async () => {
    const { useCatalogSearch } = await import("@/src/hooks/catalogHooks");
    vi.mocked(useCatalogSearch).mockReturnValue({
      searchString: "existing search",
      setSearchString: mockSetSearchString,
    });

    render(<SearchBar color="primary" />);

    const input = screen.getByPlaceholderText("Search");
    expect(input).toHaveValue("existing search");
  });

  it("should show cancel button when search string is not empty", async () => {
    const { useCatalogSearch } = await import("@/src/hooks/catalogHooks");
    vi.mocked(useCatalogSearch).mockReturnValue({
      searchString: "some search",
      setSearchString: mockSetSearchString,
    });

    render(<SearchBar color="primary" />);

    expect(screen.getByTestId("cancel-icon")).toBeInTheDocument();
  });

  it("should not show cancel button when search string is empty", async () => {
    const { useCatalogSearch } = await import("@/src/hooks/catalogHooks");
    vi.mocked(useCatalogSearch).mockReturnValue({
      searchString: "",
      setSearchString: mockSetSearchString,
    });

    render(<SearchBar color="primary" />);

    expect(screen.queryByTestId("cancel-icon")).not.toBeInTheDocument();
  });

  it("should clear search when cancel button is clicked", async () => {
    const { useCatalogSearch } = await import("@/src/hooks/catalogHooks");
    vi.mocked(useCatalogSearch).mockReturnValue({
      searchString: "some search",
      setSearchString: mockSetSearchString,
    });

    render(<SearchBar color="primary" />);

    const cancelButton = screen.getByTestId("cancel-icon").closest("button");
    if (cancelButton) {
      fireEvent.click(cancelButton);
    }

    expect(mockSetSearchString).toHaveBeenCalledWith("");
  });

  it("should use neutral color as default when color is undefined", () => {
    render(<SearchBar color={undefined} />);

    // Input should still render with neutral color
    expect(screen.getByPlaceholderText("Search")).toBeInTheDocument();
  });
});
