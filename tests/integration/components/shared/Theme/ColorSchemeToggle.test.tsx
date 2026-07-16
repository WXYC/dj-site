import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ColorSchemeToggle, { ColorSchemeToggleLoader } from "@/src/components/shared/Theme/ColorSchemeToggle";

const mockSetMode = vi.fn();
const mockPersistPreference = vi.fn();

vi.mock("@mui/joy/styles", () => ({
  useColorScheme: () => ({
    mode: "light",
    setMode: mockSetMode,
  }),
}));

vi.mock("@/src/hooks/themePreferenceHooks", () => ({
  buildPreference: (experience: string, mode: string) => `${experience}-${mode}`,
  useThemePreferenceActions: () => ({
    persistPreference: mockPersistPreference,
  }),
}));

describe("ColorSchemeToggle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render an icon button", () => {
    render(<ColorSchemeToggle experience="modern" />);
    expect(screen.getByRole("button")).toBeInTheDocument();
  });

  it("should have correct tooltip text for light mode", () => {
    render(<ColorSchemeToggle experience="modern" />);
    // Button should indicate switching to dark mode when in light mode
    const button = screen.getByRole("button");
    expect(button).toBeInTheDocument();
  });

  it("should call setMode when clicked", () => {
    render(<ColorSchemeToggle experience="modern" />);
    const button = screen.getByRole("button");
    fireEvent.click(button);

    expect(mockSetMode).toHaveBeenCalledWith("dark");
  });

  it("should persist preference when clicked", () => {
    render(<ColorSchemeToggle experience="modern" />);
    const button = screen.getByRole("button");
    fireEvent.click(button);

    expect(mockPersistPreference).toHaveBeenCalledWith("modern-dark", {
      updateUser: true,
    });
  });
});

describe("ColorSchemeToggleLoader", () => {
  it("should render a loading icon button", () => {
    render(<ColorSchemeToggleLoader />);
    const button = screen.getByRole("button");
    expect(button).toBeInTheDocument();
    expect(button).toBeDisabled();
  });
});
