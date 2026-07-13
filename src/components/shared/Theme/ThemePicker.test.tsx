import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderWithProviders, screen } from "@/lib/test-utils/render";

const persistPreference = vi.fn();
const setThemeId = vi.fn();

vi.mock("@/src/hooks/themePreferenceHooks", () => ({
  useThemePreferenceActions: () => ({ persistPreference }),
  buildPreference: (
    experience: string,
    mode: string,
    themeId?: string
  ) => `${experience}-${themeId ?? "default"}-${mode}`,
}));

vi.mock("@/src/styles/ModernThemeContext", () => ({
  useModernTheme: () => ({ themeId: "default", setThemeId }),
}));

import ThemePicker from "./ThemePicker";

describe("ThemePicker", () => {
  beforeEach(() => {
    persistPreference.mockClear();
    setThemeId.mockClear();
  });

  it("lists registered themes and marks the active one", async () => {
    const { user } = renderWithProviders(<ThemePicker />);
    await user.click(screen.getByRole("button", { name: /choose color theme/i }));

    expect(screen.getByText("WXYC Rose")).toBeInTheDocument();
    expect(screen.getByText("Ocean")).toBeInTheDocument();

    const active = screen.getByRole("menuitemradio", { name: /WXYC Rose/i });
    expect(active).toHaveAttribute("aria-checked", "true");
    const inactive = screen.getByRole("menuitemradio", { name: /Ocean/i });
    expect(inactive).toHaveAttribute("aria-checked", "false");
  });

  it("switches and persists the chosen theme", async () => {
    const { user } = renderWithProviders(<ThemePicker />);
    await user.click(screen.getByRole("button", { name: /choose color theme/i }));
    await user.click(screen.getByRole("menuitemradio", { name: /Ocean/i }));

    expect(setThemeId).toHaveBeenCalledWith("ocean");
    // mode defaults to light in the test CssVarsProvider
    expect(persistPreference).toHaveBeenCalledWith(
      "modern-ocean-light",
      { updateUser: true }
    );
  });
});
