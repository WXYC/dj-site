import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ThemeSwitcher, { ThemeSwitchLoader } from "./ThemeSwitcher";

// Mock next/navigation
const mockRefresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: mockRefresh,
  }),
}));

// Mock API hooks
const mockSwitchExperience = vi.fn();
const mockUseGetActiveExperienceQuery = vi.fn(() => ({
  data: "modern",
  isLoading: false,
}));
const mockUseSwitchExperienceMutation = vi.fn(() => [
  mockSwitchExperience,
  { isSuccess: false },
]);

vi.mock("@/lib/features/experiences/api", () => ({
  useGetActiveExperienceQuery: () => mockUseGetActiveExperienceQuery(),
  useSwitchExperienceMutation: () => mockUseSwitchExperienceMutation(),
}));

// Mock MUI components
vi.mock("@mui/icons-material", () => ({
  AutoFixHigh: () => <span data-testid="auto-fix-high">AutoFixHigh</span>,
  AutoFixOff: () => <span data-testid="auto-fix-off">AutoFixOff</span>,
}));

vi.mock("@mui/joy", () => ({
  IconButton: ({ children, onClick, loading, disabled, id, ...props }: any) => (
    <button
      data-testid="icon-button"
      id={id}
      onClick={onClick}
      disabled={disabled || loading}
      data-loading={loading ? "true" : "false"}
      {...props}
    >
      {children}
    </button>
  ),
  Tooltip: ({ children, title, ...props }: any) => (
    <div data-testid="tooltip" data-title={title} {...props}>
      {children}
    </div>
  ),
}));

describe("ThemeSwitchLoader", () => {
  it("should render loading icon button", () => {
    render(<ThemeSwitchLoader />);

    const button = screen.getByTestId("icon-button");
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("data-loading", "true");
  });

  it("should render AutoFixHigh icon", () => {
    render(<ThemeSwitchLoader />);

    expect(screen.getByTestId("auto-fix-high")).toBeInTheDocument();
  });
});

describe("ThemeSwitcher", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseGetActiveExperienceQuery.mockReturnValue({
      data: "modern",
      isLoading: false,
    });
    mockUseSwitchExperienceMutation.mockReturnValue([
      mockSwitchExperience,
      { isSuccess: false },
    ]);
  });

  it("should render icon button with toggle-experience id", () => {
    render(<ThemeSwitcher />);

    const button = screen.getByTestId("icon-button");
    expect(button).toHaveAttribute("id", "toggle-experience");
  });

  it("should show AutoFixOff icon when experience is modern", () => {
    mockUseGetActiveExperienceQuery.mockReturnValue({
      data: "modern",
      isLoading: false,
    });

    render(<ThemeSwitcher />);

    expect(screen.getByTestId("auto-fix-off")).toBeInTheDocument();
  });

  it("should show AutoFixHigh icon when experience is classic", () => {
    mockUseGetActiveExperienceQuery.mockReturnValue({
      data: "classic",
      isLoading: false,
    });

    render(<ThemeSwitcher />);

    expect(screen.getByTestId("auto-fix-high")).toBeInTheDocument();
  });

  it("should render tooltip with correct title for modern experience", () => {
    mockUseGetActiveExperienceQuery.mockReturnValue({
      data: "modern",
      isLoading: false,
    });

    render(<ThemeSwitcher />);

    const tooltip = screen.getByTestId("tooltip");
    expect(tooltip).toHaveAttribute("data-title", "Switch to classic experience");
  });

  it("should render tooltip with correct title for classic experience", () => {
    mockUseGetActiveExperienceQuery.mockReturnValue({
      data: "classic",
      isLoading: false,
    });

    render(<ThemeSwitcher />);

    const tooltip = screen.getByTestId("tooltip");
    expect(tooltip).toHaveAttribute("data-title", "Switch to modern experience");
  });

  it("should call switchExperience to classic when clicking from modern", () => {
    mockUseGetActiveExperienceQuery.mockReturnValue({
      data: "modern",
      isLoading: false,
    });

    render(<ThemeSwitcher />);

    const button = screen.getByTestId("icon-button");
    fireEvent.click(button);

    expect(mockSwitchExperience).toHaveBeenCalledWith("classic");
  });

  it("should call switchExperience to modern when clicking from classic", () => {
    mockUseGetActiveExperienceQuery.mockReturnValue({
      data: "classic",
      isLoading: false,
    });

    render(<ThemeSwitcher />);

    const button = screen.getByTestId("icon-button");
    fireEvent.click(button);

    expect(mockSwitchExperience).toHaveBeenCalledWith("modern");
  });

  it("should be disabled when loading", () => {
    mockUseGetActiveExperienceQuery.mockReturnValue({
      data: "modern",
      isLoading: true,
    });

    render(<ThemeSwitcher />);

    const button = screen.getByTestId("icon-button");
    expect(button).toBeDisabled();
  });

  it("should call router.refresh when switch is successful", () => {
    mockUseSwitchExperienceMutation.mockReturnValue([
      mockSwitchExperience,
      { isSuccess: true },
    ]);

    render(<ThemeSwitcher />);

    expect(mockRefresh).toHaveBeenCalled();
  });

  it("should not call router.refresh when switch is not successful", () => {
    mockUseSwitchExperienceMutation.mockReturnValue([
      mockSwitchExperience,
      { isSuccess: false },
    ]);

    render(<ThemeSwitcher />);

    expect(mockRefresh).not.toHaveBeenCalled();
  });
});
