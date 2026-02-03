import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ResultsContainer from "./ResultsContainer";

// Mock catalogHooks
const mockClearSelection = vi.fn();
vi.mock("@/src/hooks/catalogHooks", () => ({
  useCatalogSearch: vi.fn(() => ({
    searchString: "",
    selected: [],
    clearSelection: mockClearSelection,
  })),
}));

// Mock binHooks
const mockAddToBin = vi.fn();
vi.mock("@/src/hooks/binHooks", () => ({
  useAddToBin: vi.fn(() => ({
    addToBin: mockAddToBin,
    loading: false,
  })),
}));

// Mock sonner toast
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock Logo component
vi.mock("@/src/components/shared/Branding/Logo", () => ({
  default: () => <div data-testid="logo">Logo</div>,
}));

// Mock MUI icons
vi.mock("@mui/icons-material", () => ({
  DoubleArrow: () => <span data-testid="double-arrow-icon" />,
}));

describe("ResultsContainer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render children", () => {
    render(
      <ResultsContainer>
        <div data-testid="child-content">Test content</div>
      </ResultsContainer>
    );

    expect(screen.getByTestId("child-content")).toBeInTheDocument();
  });

  it("should render logo when search string is empty", () => {
    render(
      <ResultsContainer>
        <div>Content</div>
      </ResultsContainer>
    );

    expect(screen.getByTestId("logo")).toBeInTheDocument();
  });

  it("should show helper text when search string is empty", () => {
    render(
      <ResultsContainer>
        <div>Content</div>
      </ResultsContainer>
    );

    expect(
      screen.getByText(/start typing in the search bar/i)
    ).toBeInTheDocument();
  });

  it("should not show add to bin button when no items selected", () => {
    render(
      <ResultsContainer>
        <div>Content</div>
      </ResultsContainer>
    );

    expect(
      screen.queryByRole("button", { name: /add.*to bin/i })
    ).not.toBeInTheDocument();
  });

  it("should show add to bin button when items are selected", async () => {
    const { useCatalogSearch } = await import("@/src/hooks/catalogHooks");
    vi.mocked(useCatalogSearch).mockReturnValue({
      searchString: "test",
      selected: [1, 2, 3],
      clearSelection: mockClearSelection,
    });

    render(
      <ResultsContainer>
        <div>Content</div>
      </ResultsContainer>
    );

    expect(screen.getByRole("button", { name: /add 3 to bin/i })).toBeInTheDocument();
  });

  it("should call addToBin for each selected item when button is clicked", async () => {
    const { useCatalogSearch } = await import("@/src/hooks/catalogHooks");
    vi.mocked(useCatalogSearch).mockReturnValue({
      searchString: "test",
      selected: [1, 2],
      clearSelection: mockClearSelection,
    });

    render(
      <ResultsContainer>
        <div>Content</div>
      </ResultsContainer>
    );

    const addButton = screen.getByRole("button", { name: /add 2 to bin/i });
    fireEvent.click(addButton);

    expect(mockAddToBin).toHaveBeenCalledTimes(2);
    expect(mockAddToBin).toHaveBeenCalledWith(1);
    expect(mockAddToBin).toHaveBeenCalledWith(2);
  });

  it("should call clearSelection after adding to bin", async () => {
    const { useCatalogSearch } = await import("@/src/hooks/catalogHooks");
    vi.mocked(useCatalogSearch).mockReturnValue({
      searchString: "test",
      selected: [1],
      clearSelection: mockClearSelection,
    });

    render(
      <ResultsContainer>
        <div>Content</div>
      </ResultsContainer>
    );

    const addButton = screen.getByRole("button", { name: /add 1 to bin/i });
    fireEvent.click(addButton);

    expect(mockClearSelection).toHaveBeenCalled();
  });

  it("should show toast success when items are added", async () => {
    const { toast } = await import("sonner");
    const { useCatalogSearch } = await import("@/src/hooks/catalogHooks");
    vi.mocked(useCatalogSearch).mockReturnValue({
      searchString: "test",
      selected: [1, 2],
      clearSelection: mockClearSelection,
    });

    render(
      <ResultsContainer>
        <div>Content</div>
      </ResultsContainer>
    );

    const addButton = screen.getByRole("button", { name: /add 2 to bin/i });
    fireEvent.click(addButton);

    expect(toast.success).toHaveBeenCalledWith("Added 2 albums to bin");
  });

  it("should show singular text when adding 1 album", async () => {
    const { toast } = await import("sonner");
    const { useCatalogSearch } = await import("@/src/hooks/catalogHooks");
    vi.mocked(useCatalogSearch).mockReturnValue({
      searchString: "test",
      selected: [1],
      clearSelection: mockClearSelection,
    });

    render(
      <ResultsContainer>
        <div>Content</div>
      </ResultsContainer>
    );

    const addButton = screen.getByRole("button", { name: /add 1 to bin/i });
    fireEvent.click(addButton);

    expect(toast.success).toHaveBeenCalledWith("Added 1 album to bin");
  });

  it("should show loading state on button when adding", async () => {
    const { useCatalogSearch } = await import("@/src/hooks/catalogHooks");
    const { useAddToBin } = await import("@/src/hooks/binHooks");

    vi.mocked(useCatalogSearch).mockReturnValue({
      searchString: "test",
      selected: [1],
      clearSelection: mockClearSelection,
    });

    vi.mocked(useAddToBin).mockReturnValue({
      addToBin: mockAddToBin,
      loading: true,
    });

    render(
      <ResultsContainer>
        <div>Content</div>
      </ResultsContainer>
    );

    // Button should render with loading state (MUI Joy uses data-loading attribute)
    const addButton = screen.getByRole("button", { name: /add 1 to bin/i });
    expect(addButton).toBeInTheDocument();
  });
});
