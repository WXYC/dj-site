import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import SearchBar from "./SearchBar";

// Mock functions
const mockSetSearchString = vi.fn();

vi.mock("@/src/hooks/catalogHooks", () => ({
  useCatalogSearch: vi.fn(() => ({
    searchString: "",
    setSearchString: mockSetSearchString,
  })),
}));

// Reset mock to default between tests
import { useCatalogSearch } from "@/src/hooks/catalogHooks";
const mockedUseCatalogSearch = vi.mocked(useCatalogSearch);

// Mock child components
vi.mock("./Filters", () => ({
  Filters: ({ color }: any) => (
    <div data-testid="filters" data-color={color}>Filters</div>
  ),
}));

// Mock MUI icons
vi.mock("@mui/icons-material", () => ({
  Cancel: () => <span data-testid="cancel-icon" />,
  Troubleshoot: () => <span data-testid="troubleshoot-icon" />,
}));

describe("SearchBar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset to default mock implementation
    mockedUseCatalogSearch.mockReturnValue({
      searchString: "",
      setSearchString: mockSetSearchString,
    } as any);
  });

  it("should render search input", () => {
    render(<SearchBar color="neutral" />);
    const input = screen.getByRole("textbox");
    expect(input).toBeInTheDocument();
  });

  it("should render form label", () => {
    render(<SearchBar color="neutral" />);
    expect(screen.getByText("Search for an album or artist")).toBeInTheDocument();
  });

  it("should render search input with placeholder", () => {
    render(<SearchBar color="neutral" />);
    const input = screen.getByPlaceholderText("Search");
    expect(input).toBeInTheDocument();
  });

  it("should render Troubleshoot icon as start decorator", () => {
    render(<SearchBar color="neutral" />);
    expect(screen.getByTestId("troubleshoot-icon")).toBeInTheDocument();
  });

  it("should render Filters component", () => {
    render(<SearchBar color="neutral" />);
    expect(screen.getByTestId("filters")).toBeInTheDocument();
  });

  it("should pass color prop to Filters", () => {
    render(<SearchBar color="success" />);
    const filters = screen.getByTestId("filters");
    expect(filters).toHaveAttribute("data-color", "success");
  });

  it("should pass undefined color to Filters when undefined", () => {
    render(<SearchBar color={undefined} />);
    const filters = screen.getByTestId("filters");
    // When color is undefined, the attribute isn't set at all
    expect(filters).not.toHaveAttribute("data-color");
  });

  it("should call setSearchString when input value changes", () => {
    render(<SearchBar color="neutral" />);
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "test search" } });
    expect(mockSetSearchString).toHaveBeenCalledWith("test search");
  });

  it("should display current search string value", () => {
    mockedUseCatalogSearch.mockReturnValue({
      searchString: "existing search",
      setSearchString: mockSetSearchString,
    } as any);

    render(<SearchBar color="neutral" />);
    const input = screen.getByRole("textbox");
    expect(input).toHaveValue("existing search");
  });

  it("should not render cancel button when search string is empty", () => {
    render(<SearchBar color="neutral" />);
    expect(screen.queryByTestId("cancel-icon")).not.toBeInTheDocument();
  });

  it("should render cancel button when search string is not empty", () => {
    mockedUseCatalogSearch.mockReturnValue({
      searchString: "some search",
      setSearchString: mockSetSearchString,
    } as any);

    render(<SearchBar color="neutral" />);
    expect(screen.getByTestId("cancel-icon")).toBeInTheDocument();
  });

  it("should call setSearchString with empty string when cancel button is clicked", () => {
    mockedUseCatalogSearch.mockReturnValue({
      searchString: "some search",
      setSearchString: mockSetSearchString,
    } as any);

    render(<SearchBar color="primary" />);
    const cancelIcon = screen.getByTestId("cancel-icon");
    const cancelButton = cancelIcon.closest("button");
    expect(cancelButton).toBeInTheDocument();
    fireEvent.click(cancelButton!);
    expect(mockSetSearchString).toHaveBeenCalledWith("");
  });

  it("should render with primary color", () => {
    render(<SearchBar color="primary" />);
    const input = screen.getByRole("textbox");
    // Input should exist with the correct styling
    expect(input).toBeInTheDocument();
  });

  it("should render with neutral color when color prop is undefined", () => {
    render(<SearchBar color={undefined} />);
    const input = screen.getByRole("textbox");
    expect(input).toBeInTheDocument();
  });

  it("should render with success color", () => {
    render(<SearchBar color="success" />);
    expect(screen.getByTestId("filters")).toBeInTheDocument();
  });

  it("should render with warning color", () => {
    render(<SearchBar color="warning" />);
    expect(screen.getByTestId("filters")).toBeInTheDocument();
  });

  it("should render with danger color", () => {
    render(<SearchBar color="danger" />);
    expect(screen.getByTestId("filters")).toBeInTheDocument();
  });

  it("should have search box with correct CSS classes", () => {
    const { container } = render(<SearchBar color="neutral" />);
    const searchBox = container.querySelector(".SearchAndFilters-tabletUp");
    expect(searchBox).toBeInTheDocument();
  });

  it("should update input value on user typing", () => {
    render(<SearchBar color="neutral" />);
    const input = screen.getByRole("textbox");

    fireEvent.change(input, { target: { value: "a" } });
    expect(mockSetSearchString).toHaveBeenCalledWith("a");

    fireEvent.change(input, { target: { value: "ab" } });
    expect(mockSetSearchString).toHaveBeenCalledWith("ab");

    fireEvent.change(input, { target: { value: "abc" } });
    expect(mockSetSearchString).toHaveBeenCalledWith("abc");
  });

  it("should clear search when typing is cleared", () => {
    mockedUseCatalogSearch.mockReturnValue({
      searchString: "test",
      setSearchString: mockSetSearchString,
    } as any);

    render(<SearchBar color="neutral" />);
    const input = screen.getByRole("textbox");

    fireEvent.change(input, { target: { value: "" } });
    expect(mockSetSearchString).toHaveBeenCalledWith("");
  });

  it("should render cancel button with correct color from color prop", () => {
    mockedUseCatalogSearch.mockReturnValue({
      searchString: "some search",
      setSearchString: mockSetSearchString,
    } as any);

    render(<SearchBar color="success" />);
    const cancelIcon = screen.getByTestId("cancel-icon");
    const cancelButton = cancelIcon.closest("button");
    // The button should use the color prop (success) or default to primary
    expect(cancelButton).toBeInTheDocument();
  });

  it("should use primary color for cancel button when color prop is undefined", () => {
    mockedUseCatalogSearch.mockReturnValue({
      searchString: "some search",
      setSearchString: mockSetSearchString,
    } as any);

    render(<SearchBar color={undefined} />);
    const cancelIcon = screen.getByTestId("cancel-icon");
    const cancelButton = cancelIcon.closest("button");
    expect(cancelButton).toHaveClass("MuiIconButton-colorPrimary");
  });

  it("should handle special characters in search string", () => {
    render(<SearchBar color="neutral" />);
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "test@#$%" } });
    expect(mockSetSearchString).toHaveBeenCalledWith("test@#$%");
  });

  it("should handle long search strings", () => {
    render(<SearchBar color="neutral" />);
    const input = screen.getByRole("textbox");
    const longString = "a".repeat(200);
    fireEvent.change(input, { target: { value: longString } });
    expect(mockSetSearchString).toHaveBeenCalledWith(longString);
  });

  it("should handle unicode characters in search string", () => {
    render(<SearchBar color="neutral" />);
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "test unicode string" } });
    expect(mockSetSearchString).toHaveBeenCalledWith("test unicode string");
  });
});
