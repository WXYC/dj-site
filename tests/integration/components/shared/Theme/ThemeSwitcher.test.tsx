import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ThemeSwitcher, { ThemeSwitchLoader } from "@/src/components/shared/Theme/ThemeSwitcher";

const mockPersistPreference = vi.fn();
const mockReload = vi.fn();

// jsdom cannot navigate; stub reload so switching doesn't error.
Object.defineProperty(window, "location", {
  configurable: true,
  value: { ...window.location, reload: mockReload },
});

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
    // Resolves true = cookie write succeeded, so the switcher may reload.
    mockPersistPreference.mockResolvedValue(true);
  });

  it("should render an icon button", () => {
    render(<ThemeSwitcher experience="modern" />);
    expect(screen.getByRole("button")).toBeInTheDocument();
  });

  it("should call persistPreference when clicked", async () => {
    render(<ThemeSwitcher experience="modern" />);
    const button = screen.getByRole("button");
    fireEvent.click(button);

    expect(mockPersistPreference).toHaveBeenCalledWith("classic-light", {
      updateUser: true,
    });
  });

  it("should hard-reload after switching (CssVarsProvider can't repaint on a soft refresh)", async () => {
    render(<ThemeSwitcher experience="modern" />);
    const button = screen.getByRole("button");
    fireEvent.click(button);

    // Wait for async operations
    await vi.waitFor(() => {
      expect(mockReload).toHaveBeenCalled();
    });
  });

  it("should not reload when the cookie write failed", async () => {
    mockPersistPreference.mockResolvedValueOnce(false);
    render(<ThemeSwitcher experience="modern" />);
    fireEvent.click(screen.getByRole("button"));

    await vi.waitFor(() => {
      expect(mockPersistPreference).toHaveBeenCalled();
    });
    expect(mockReload).not.toHaveBeenCalled();
  });
});

describe("ThemeSwitcher button", () => {
  it("should have the toggle-experience id", () => {
    render(<ThemeSwitcher experience="modern" />);
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
