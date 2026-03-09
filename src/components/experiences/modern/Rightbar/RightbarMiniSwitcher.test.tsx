import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import RightbarMiniSwitcher from "./RightbarMiniSwitcher";

// Mock API hooks
const mockToggleRightbar = vi.fn();
const mockUseGetRightbarQuery = vi.fn(() => ({
  data: false,
  isLoading: false,
}));

vi.mock("@/lib/features/application/api", () => ({
  useGetRightbarQuery: () => mockUseGetRightbarQuery(),
  useToggleRightbarMutation: () => [mockToggleRightbar],
}));

// Mock MUI components
vi.mock("@mui/icons-material", () => ({
  ArrowDropDown: () => <span data-testid="arrow-down">ArrowDown</span>,
  ArrowDropUp: () => <span data-testid="arrow-up">ArrowUp</span>,
}));

vi.mock("@mui/joy", () => ({
  IconButton: ({ children, onClick, disabled, ...props }: any) => (
    <button
      data-testid="icon-button"
      onClick={onClick}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  ),
}));

describe("RightbarMiniSwitcher", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseGetRightbarQuery.mockReturnValue({
      data: false,
      isLoading: false,
    });
  });

  it("should render icon button", () => {
    render(<RightbarMiniSwitcher />);

    expect(screen.getByTestId("icon-button")).toBeInTheDocument();
  });

  it("should show ArrowDropUp icon when not mini", () => {
    mockUseGetRightbarQuery.mockReturnValue({
      data: false,
      isLoading: false,
    });

    render(<RightbarMiniSwitcher />);

    expect(screen.getByTestId("arrow-up")).toBeInTheDocument();
  });

  it("should show ArrowDropDown icon when mini", () => {
    mockUseGetRightbarQuery.mockReturnValue({
      data: true,
      isLoading: false,
    });

    render(<RightbarMiniSwitcher />);

    expect(screen.getByTestId("arrow-down")).toBeInTheDocument();
  });

  it("should call toggleRightbar when clicked", () => {
    render(<RightbarMiniSwitcher />);

    const button = screen.getByTestId("icon-button");
    fireEvent.click(button);

    expect(mockToggleRightbar).toHaveBeenCalled();
  });

  it("should be disabled when loading", () => {
    mockUseGetRightbarQuery.mockReturnValue({
      data: false,
      isLoading: true,
    });

    render(<RightbarMiniSwitcher />);

    const button = screen.getByTestId("icon-button");
    expect(button).toBeDisabled();
  });

  it("should not be disabled when not loading", () => {
    mockUseGetRightbarQuery.mockReturnValue({
      data: false,
      isLoading: false,
    });

    render(<RightbarMiniSwitcher />);

    const button = screen.getByTestId("icon-button");
    expect(button).not.toBeDisabled();
  });
});
