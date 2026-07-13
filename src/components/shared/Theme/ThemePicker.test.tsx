import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderWithProviders, screen } from "@/lib/test-utils/render";

const persistPreference = vi.fn().mockResolvedValue(undefined);
const setThemeId = vi.fn();
const reload = vi.fn();

vi.mock("@/src/hooks/themePreferenceHooks", () => ({
  useThemePreferenceActions: () => ({ persistPreference }),
  buildPreference: (
    experience: string,
    mode: string,
    themeId?: string
  ) => `${experience}-${themeId ?? "default"}-${mode}`,
}));

vi.mock("@/src/styles/ModernThemeContext", () => ({
  useModernTheme: () => ({ themeId: "stacks", setThemeId }),
}));

// jsdom cannot navigate; stub reload so selecting a theme doesn't error.
Object.defineProperty(window, "location", {
  configurable: true,
  value: { ...window.location, reload },
});

import ThemePicker from "./ThemePicker";

describe("ThemePicker", () => {
  beforeEach(() => {
    persistPreference.mockClear();
    setThemeId.mockClear();
    reload.mockClear();
  });

  it("lists registered themes and marks the active one", async () => {
    const { user } = renderWithProviders(<ThemePicker />);
    await user.click(screen.getByRole("button", { name: /choose color theme/i }));

    expect(screen.getByText("The Stacks")).toBeInTheDocument();
    expect(screen.getByText("Blue Note")).toBeInTheDocument();

    const active = screen.getByRole("menuitemradio", { name: /The Stacks/i });
    expect(active).toHaveAttribute("aria-checked", "true");
    const inactive = screen.getByRole("menuitemradio", { name: /Blue Note/i });
    expect(inactive).toHaveAttribute("aria-checked", "false");
  });

  it("switches and persists the chosen theme, then reloads", async () => {
    const { user } = renderWithProviders(<ThemePicker />);
    await user.click(screen.getByRole("button", { name: /choose color theme/i }));
    await user.click(screen.getByRole("menuitemradio", { name: /Blue Note/i }));

    expect(setThemeId).toHaveBeenCalledWith("bluenote");
    // mode defaults to light in the test CssVarsProvider
    expect(persistPreference).toHaveBeenCalledWith(
      "modern-bluenote-light",
      { updateUser: true }
    );
    expect(reload).toHaveBeenCalled();
  });

  it("closes on an outside click without switching themes", async () => {
    const { user } = renderWithProviders(<ThemePicker />);
    await user.click(screen.getByRole("button", { name: /choose color theme/i }));
    expect(screen.getByText("Blue Note")).toBeInTheDocument();

    await user.click(document.body);

    expect(screen.queryByText("Blue Note")).not.toBeInTheDocument();
    expect(setThemeId).not.toHaveBeenCalled();
    expect(persistPreference).not.toHaveBeenCalled();
  });

  it("does not persist or reload when picking the active theme", async () => {
    const { user } = renderWithProviders(<ThemePicker />);
    await user.click(screen.getByRole("button", { name: /choose color theme/i }));
    await user.click(screen.getByRole("menuitemradio", { name: /The Stacks/i }));

    expect(persistPreference).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
  });
});
