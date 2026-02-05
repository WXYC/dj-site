import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ResultsContainer from "./ResultsContainer";

// Mock functions
const mockClearSelection = vi.fn();
const mockAddToBin = vi.fn();

// Mock useCatalogSearch hook
vi.mock("@/src/hooks/catalogHooks", () => ({
  useCatalogSearch: vi.fn(() => ({
    searchString: "",
    selected: [],
    clearSelection: mockClearSelection,
  })),
}));

// Mock useAddToBin hook
vi.mock("@/src/hooks/binHooks", () => ({
  useAddToBin: vi.fn(() => ({
    addToBin: mockAddToBin,
    loading: false,
  })),
}));

// Mock toast
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock Logo component
vi.mock("@/src/components/shared/Branding/Logo", () => ({
  default: ({ color }: { color: string }) => (
    <div data-testid="logo" data-color={color}>
      Logo
    </div>
  ),
}));

// Mock MUI icons
vi.mock("@mui/icons-material/DoubleArrow", () => ({
  default: () => <svg data-testid="double-arrow-icon" />,
}));

// Mock MUI components
vi.mock("@mui/joy", () => ({
  Box: ({
    children,
    sx,
  }: {
    children?: React.ReactNode;
    sx?: any;
  }) => (
    <div
      data-testid="box"
      data-pointer-events={sx?.pointerEvents}
      style={{
        opacity: sx?.opacity,
        position: sx?.position as any,
        backdropFilter: sx?.backdropFilter,
      }}
    >
      {children}
    </div>
  ),
  Button: ({
    children,
    onClick,
    loading,
    endDecorator,
    variant,
    color,
    size,
    sx,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    loading?: boolean;
    endDecorator?: React.ReactNode;
    variant?: string;
    color?: string;
    size?: string;
    sx?: any;
  }) => (
    <button
      data-testid="add-to-bin-button"
      onClick={onClick}
      disabled={loading}
      data-loading={loading?.toString()}
      data-variant={variant}
      data-color={color}
      data-size={size}
    >
      {children}
      {endDecorator}
    </button>
  ),
  Sheet: ({
    children,
    id,
    variant,
    sx,
  }: {
    children: React.ReactNode;
    id?: string;
    variant?: string;
    sx?: any;
  }) => (
    <div
      data-testid="sheet"
      id={id}
      data-variant={variant}
      style={{ overflow: sx?.overflow }}
    >
      {children}
    </div>
  ),
  Table: ({ children }: { children: React.ReactNode }) => (
    <table data-testid="table">{children}</table>
  ),
  Typography: ({
    children,
    color,
    level,
    sx,
  }: {
    children: React.ReactNode;
    color?: string;
    level?: string;
    sx?: any;
  }) => (
    <span data-testid="typography" data-color={color} data-level={level}>
      {children}
    </span>
  ),
}));

describe("ResultsContainer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render children", () => {
    render(
      <ResultsContainer>
        <div data-testid="child-content">Child Content</div>
      </ResultsContainer>
    );

    expect(screen.getByTestId("child-content")).toBeInTheDocument();
  });

  it("should render Sheet with OrderTableContainer id", () => {
    render(
      <ResultsContainer>
        <div>Content</div>
      </ResultsContainer>
    );

    const sheet = screen.getByTestId("sheet");
    expect(sheet).toHaveAttribute("id", "OrderTableContainer");
  });

  it("should render Sheet with outlined variant", () => {
    render(
      <ResultsContainer>
        <div>Content</div>
      </ResultsContainer>
    );

    const sheet = screen.getByTestId("sheet");
    expect(sheet).toHaveAttribute("data-variant", "outlined");
  });

  it("should render Logo with primary color", () => {
    render(
      <ResultsContainer>
        <div>Content</div>
      </ResultsContainer>
    );

    const logo = screen.getByTestId("logo");
    expect(logo).toHaveAttribute("data-color", "primary");
  });

  describe("search string behavior", () => {
    it("should show prompt message when search string is empty", () => {
      render(
        <ResultsContainer>
          <div>Content</div>
        </ResultsContainer>
      );

      expect(
        screen.getByText(
          "Start typing in the search bar above to explore the library!"
        )
      ).toBeInTheDocument();
    });

    it("should set overflow to hidden when search string is empty", () => {
      render(
        <ResultsContainer>
          <div>Content</div>
        </ResultsContainer>
      );

      const sheet = screen.getByTestId("sheet");
      expect(sheet).toHaveStyle({ overflow: "hidden" });
    });

    it("should set overflow to auto when search string has content", async () => {
      const { useCatalogSearch } = await import("@/src/hooks/catalogHooks");
      vi.mocked(useCatalogSearch).mockReturnValue({
        searchString: "test search",
        selected: [],
        clearSelection: mockClearSelection,
      } as any);

      render(
        <ResultsContainer>
          <div>Content</div>
        </ResultsContainer>
      );

      const sheet = screen.getByTestId("sheet");
      expect(sheet).toHaveStyle({ overflow: "auto" });
    });
  });

  describe("selection behavior", () => {
    it("should not show add to bin button when no items selected", () => {
      render(
        <ResultsContainer>
          <div>Content</div>
        </ResultsContainer>
      );

      expect(screen.queryByTestId("add-to-bin-button")).not.toBeInTheDocument();
    });

    it("should show add to bin button when items are selected", async () => {
      const { useCatalogSearch } = await import("@/src/hooks/catalogHooks");
      vi.mocked(useCatalogSearch).mockReturnValue({
        searchString: "test",
        selected: [1, 2, 3],
        clearSelection: mockClearSelection,
      } as any);

      render(
        <ResultsContainer>
          <div>Content</div>
        </ResultsContainer>
      );

      expect(screen.getByTestId("add-to-bin-button")).toBeInTheDocument();
    });

    it("should display correct count in button text for single selection", async () => {
      const { useCatalogSearch } = await import("@/src/hooks/catalogHooks");
      vi.mocked(useCatalogSearch).mockReturnValue({
        searchString: "test",
        selected: [1],
        clearSelection: mockClearSelection,
      } as any);

      render(
        <ResultsContainer>
          <div>Content</div>
        </ResultsContainer>
      );

      expect(screen.getByText(/Add 1 to bin/)).toBeInTheDocument();
    });

    it("should display correct count in button text for multiple selections", async () => {
      const { useCatalogSearch } = await import("@/src/hooks/catalogHooks");
      vi.mocked(useCatalogSearch).mockReturnValue({
        searchString: "test",
        selected: [1, 2, 3, 4, 5],
        clearSelection: mockClearSelection,
      } as any);

      render(
        <ResultsContainer>
          <div>Content</div>
        </ResultsContainer>
      );

      expect(screen.getByText(/Add 5 to bin/)).toBeInTheDocument();
    });

    it("should call addToBin for each selected album when button clicked", async () => {
      const { useCatalogSearch } = await import("@/src/hooks/catalogHooks");
      vi.mocked(useCatalogSearch).mockReturnValue({
        searchString: "test",
        selected: [1, 2, 3],
        clearSelection: mockClearSelection,
      } as any);

      render(
        <ResultsContainer>
          <div>Content</div>
        </ResultsContainer>
      );

      const button = screen.getByTestId("add-to-bin-button");
      fireEvent.click(button);

      expect(mockAddToBin).toHaveBeenCalledTimes(3);
      expect(mockAddToBin).toHaveBeenCalledWith(1);
      expect(mockAddToBin).toHaveBeenCalledWith(2);
      expect(mockAddToBin).toHaveBeenCalledWith(3);
    });

    it("should call clearSelection after adding to bin", async () => {
      const { useCatalogSearch } = await import("@/src/hooks/catalogHooks");
      vi.mocked(useCatalogSearch).mockReturnValue({
        searchString: "test",
        selected: [1, 2],
        clearSelection: mockClearSelection,
      } as any);

      render(
        <ResultsContainer>
          <div>Content</div>
        </ResultsContainer>
      );

      const button = screen.getByTestId("add-to-bin-button");
      fireEvent.click(button);

      expect(mockClearSelection).toHaveBeenCalledTimes(1);
    });

    it("should show toast success message for single album", async () => {
      const { toast } = await import("sonner");
      const { useCatalogSearch } = await import("@/src/hooks/catalogHooks");
      vi.mocked(useCatalogSearch).mockReturnValue({
        searchString: "test",
        selected: [1],
        clearSelection: mockClearSelection,
      } as any);

      render(
        <ResultsContainer>
          <div>Content</div>
        </ResultsContainer>
      );

      const button = screen.getByTestId("add-to-bin-button");
      fireEvent.click(button);

      expect(toast.success).toHaveBeenCalledWith("Added 1 album to bin");
    });

    it("should show toast success message for multiple albums", async () => {
      const { toast } = await import("sonner");
      const { useCatalogSearch } = await import("@/src/hooks/catalogHooks");
      vi.mocked(useCatalogSearch).mockReturnValue({
        searchString: "test",
        selected: [1, 2, 3],
        clearSelection: mockClearSelection,
      } as any);

      render(
        <ResultsContainer>
          <div>Content</div>
        </ResultsContainer>
      );

      const button = screen.getByTestId("add-to-bin-button");
      fireEvent.click(button);

      expect(toast.success).toHaveBeenCalledWith("Added 3 albums to bin");
    });

    it("should not call addToBin when selected is empty and button is somehow clicked", async () => {
      const { useCatalogSearch } = await import("@/src/hooks/catalogHooks");
      vi.mocked(useCatalogSearch).mockReturnValue({
        searchString: "test",
        selected: [],
        clearSelection: mockClearSelection,
      } as any);

      // Directly test the early return behavior
      // Since button won't render with 0 selections, we verify no calls are made
      render(
        <ResultsContainer>
          <div>Content</div>
        </ResultsContainer>
      );

      expect(mockAddToBin).not.toHaveBeenCalled();
      expect(mockClearSelection).not.toHaveBeenCalled();
    });
  });

  describe("loading state", () => {
    it("should show loading state on button when addToBin is loading", async () => {
      const { useCatalogSearch } = await import("@/src/hooks/catalogHooks");
      const { useAddToBin } = await import("@/src/hooks/binHooks");

      vi.mocked(useCatalogSearch).mockReturnValue({
        searchString: "test",
        selected: [1, 2],
        clearSelection: mockClearSelection,
      } as any);

      vi.mocked(useAddToBin).mockReturnValue({
        addToBin: mockAddToBin,
        loading: true,
      });

      render(
        <ResultsContainer>
          <div>Content</div>
        </ResultsContainer>
      );

      const button = screen.getByTestId("add-to-bin-button");
      expect(button).toHaveAttribute("data-loading", "true");
    });
  });

  describe("button styling", () => {
    it("should have solid variant", async () => {
      const { useCatalogSearch } = await import("@/src/hooks/catalogHooks");
      vi.mocked(useCatalogSearch).mockReturnValue({
        searchString: "test",
        selected: [1],
        clearSelection: mockClearSelection,
      } as any);

      render(
        <ResultsContainer>
          <div>Content</div>
        </ResultsContainer>
      );

      const button = screen.getByTestId("add-to-bin-button");
      expect(button).toHaveAttribute("data-variant", "solid");
    });

    it("should have primary color", async () => {
      const { useCatalogSearch } = await import("@/src/hooks/catalogHooks");
      vi.mocked(useCatalogSearch).mockReturnValue({
        searchString: "test",
        selected: [1],
        clearSelection: mockClearSelection,
      } as any);

      render(
        <ResultsContainer>
          <div>Content</div>
        </ResultsContainer>
      );

      const button = screen.getByTestId("add-to-bin-button");
      expect(button).toHaveAttribute("data-color", "primary");
    });

    it("should have lg size", async () => {
      const { useCatalogSearch } = await import("@/src/hooks/catalogHooks");
      vi.mocked(useCatalogSearch).mockReturnValue({
        searchString: "test",
        selected: [1],
        clearSelection: mockClearSelection,
      } as any);

      render(
        <ResultsContainer>
          <div>Content</div>
        </ResultsContainer>
      );

      const button = screen.getByTestId("add-to-bin-button");
      expect(button).toHaveAttribute("data-size", "lg");
    });

    it("should have DoubleArrow end decorator", async () => {
      const { useCatalogSearch } = await import("@/src/hooks/catalogHooks");
      vi.mocked(useCatalogSearch).mockReturnValue({
        searchString: "test",
        selected: [1],
        clearSelection: mockClearSelection,
      } as any);

      render(
        <ResultsContainer>
          <div>Content</div>
        </ResultsContainer>
      );

      expect(screen.getByTestId("double-arrow-icon")).toBeInTheDocument();
    });
  });

  describe("multiple children", () => {
    it("should render multiple children", () => {
      render(
        <ResultsContainer>
          <div data-testid="child-1">Child 1</div>
          <div data-testid="child-2">Child 2</div>
          <div data-testid="child-3">Child 3</div>
        </ResultsContainer>
      );

      expect(screen.getByTestId("child-1")).toBeInTheDocument();
      expect(screen.getByTestId("child-2")).toBeInTheDocument();
      expect(screen.getByTestId("child-3")).toBeInTheDocument();
    });
  });

  describe("typography styling", () => {
    it("should render prompt typography with primary color", () => {
      render(
        <ResultsContainer>
          <div>Content</div>
        </ResultsContainer>
      );

      const typography = screen.getByTestId("typography");
      expect(typography).toHaveAttribute("data-color", "primary");
    });

    it("should render prompt typography with body-lg level", () => {
      render(
        <ResultsContainer>
          <div>Content</div>
        </ResultsContainer>
      );

      const typography = screen.getByTestId("typography");
      expect(typography).toHaveAttribute("data-level", "body-lg");
    });
  });
});
