import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ThemeSwitcher, { ThemeSwitchLoader } from "./ThemeSwitcher";

const mockRefresh = vi.fn();
const mockPersistPreference = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: mockRefresh,
  }),
}));

vi.mock("@/lib/features/experiences/api", () => ({
  useGetActiveExperienceQuery: () => ({
    data: "modern",
    isLoading: false,
  }),
}));

vi.mock("@mui/joy/styles", () => ({
  useColorScheme: () => ({
    mode: "light",
  }),
}));

vi.mock("@/src/hooks/themePreferenceHooks", () => ({
  buildPreference: (experience: string, mode: string) => `${experience}-${mode}`,
  useThemePreferenceActions: () => ({
    persistPreference: mockPersistPreference,
  }),
}));

describe("ThemeSwitcher", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPersistPreference.mockResolvedValue(undefined);
  });

  it("should render an icon button", () => {
    render(<ThemeSwitcher />);
    expect(screen.getByRole("button")).toBeInTheDocument();
  });

  it("should call persistPreference when clicked", async () => {
    render(<ThemeSwitcher />);
    const button = screen.getByRole("button");
    fireEvent.click(button);

    expect(mockPersistPreference).toHaveBeenCalledWith("classic-light", {
      updateUser: true,
    });
  });

  it("should call router.refresh after switching", async () => {
    render(<ThemeSwitcher />);
    const button = screen.getByRole("button");
    fireEvent.click(button);

    // Wait for async operations
    await vi.waitFor(() => {
      expect(mockRefresh).toHaveBeenCalled();
    });
  });
});

describe("ThemeSwitcher button", () => {
  it("should have the toggle-experience id", () => {
    render(<ThemeSwitcher />);
    const button = screen.getByRole("button");
    expect(button).toHaveAttribute("id", "toggle-experience");
  });
});

describe("ThemeSwitchLoader", () => {
  it("should render a loading icon button", () => {
    render(<ThemeSwitchLoader />);
    const button = screen.getByRole("button");
    expect(button).toBeInTheDocument();
    expect(button).toBeDisabled();
  });
});
