import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ThemeSwitcher, { ThemeSwitchLoader } from "./ThemeSwitcher";

const mockRefresh = vi.fn();
const mockPersistPreference = vi.fn();

// Configurable mock values
let mockExperience: string | undefined = "modern";
let mockIsLoading = false;
let mockMode: string | undefined = "light";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: mockRefresh,
  }),
}));

vi.mock("@/lib/features/experiences/api", () => ({
  useGetActiveExperienceQuery: () => ({
    data: mockExperience,
    isLoading: mockIsLoading,
  }),
}));

vi.mock("@mui/joy/styles", () => ({
  useColorScheme: () => ({
    mode: mockMode,
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
    // Reset to default values
    mockExperience = "modern";
    mockIsLoading = false;
    mockMode = "light";
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
  beforeEach(() => {
    mockExperience = "modern";
    mockIsLoading = false;
    mockMode = "light";
  });

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

describe("ThemeSwitcher with classic experience", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPersistPreference.mockResolvedValue(undefined);
    mockExperience = "classic";
    mockIsLoading = false;
    mockMode = "light";
  });

  it("should switch to modern when current experience is classic", () => {
    render(<ThemeSwitcher />);
    const button = screen.getByRole("button");
    fireEvent.click(button);

    expect(mockPersistPreference).toHaveBeenCalledWith("modern-light", {
      updateUser: true,
    });
  });
});

describe("ThemeSwitcher with dark mode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPersistPreference.mockResolvedValue(undefined);
    mockExperience = "modern";
    mockIsLoading = false;
    mockMode = "dark";
  });

  it("should preserve dark mode when switching", () => {
    render(<ThemeSwitcher />);
    const button = screen.getByRole("button");
    fireEvent.click(button);

    expect(mockPersistPreference).toHaveBeenCalledWith("classic-dark", {
      updateUser: true,
    });
  });
});

describe("ThemeSwitcher with undefined mode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPersistPreference.mockResolvedValue(undefined);
    mockExperience = "modern";
    mockIsLoading = false;
  });

  it("should default to light mode when mode is undefined", () => {
    mockMode = undefined;

    render(<ThemeSwitcher />);
    const button = screen.getByRole("button");
    fireEvent.click(button);

    expect(mockPersistPreference).toHaveBeenCalledWith("classic-light", {
      updateUser: true,
    });
  });

  it("should default to light mode when mode is system", () => {
    mockMode = "system";

    render(<ThemeSwitcher />);
    const button = screen.getByRole("button");
    fireEvent.click(button);

    expect(mockPersistPreference).toHaveBeenCalledWith("classic-light", {
      updateUser: true,
    });
  });
});

describe("ThemeSwitcher loading state", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExperience = undefined;
    mockIsLoading = true;
    mockMode = "light";
  });

  it("should be disabled when loading", () => {
    render(<ThemeSwitcher />);
    const button = screen.getByRole("button");
    expect(button).toBeDisabled();
  });
});
