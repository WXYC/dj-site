import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/tests/helpers";

vi.mock("next/font/google", () => ({
  Kanit: () => ({ style: { fontFamily: "Kanit, sans-serif" } }),
}));
vi.mock("next/font/local", () => ({
  default: () => ({ style: { fontFamily: "Minbus, sans-serif" } }),
}));

import { CssVarsProvider } from "@mui/joy/styles";
import type { ReactElement } from "react";
import modernTheme from "@/lib/features/experiences/modern/theme";
import { ArtistAvatar } from "@/src/components/experiences/modern/catalog/ArtistAvatar";
import type { ArtistEntry } from "@/lib/features/catalog/types";

const inModernTheme = (ui: ReactElement) => (
  <CssVarsProvider theme={modernTheme}>{ui}</CssVarsProvider>
);

const artist = (lettercode: string, numbercode: number): ArtistEntry => ({
  name: "Juana Molina",
  lettercode,
  numbercode,
  genre: "Rock",
  id: 1,
}) as ArtistEntry;

describe("ArtistAvatar", () => {
  it.each([
    ["a compilation", "V/A", 0, "Rock CD ♪ V/A-651"],
    ["a named artist", "RO", 12, "Rock CD ♪ RO 12/651"],
  ])("composes the tooltip for %s through the shared formatter", (_, letters, number, title) => {
    renderWithProviders(
      inModernTheme(<ArtistAvatar artist={artist(letters, number)} entry={651} format="CD" />)
    );
    expect(screen.getByLabelText(title)).toBeInTheDocument();
  });

  it("hides the number slot for a compilation", () => {
    const { container } = renderWithProviders(
      inModernTheme(<ArtistAvatar artist={artist("V/A", 0)} entry={651} format="CD" />)
    );
    expect(container.textContent).toContain("V/A");
    expect(container.textContent).toContain("651");
    expect(container.textContent).not.toMatch(/(^|\D)0(\D|$)/);
  });

  it("keeps the compilation number slot in the layout but invisible and unannounced", () => {
    const { container } = renderWithProviders(
      inModernTheme(<ArtistAvatar artist={artist("V/A", 0)} entry={651} format="CD" />)
    );
    const slot = container.querySelector('[aria-hidden="true"].MuiTypography-root');
    expect(slot).not.toBeNull();
    expect(slot).toHaveStyle({ visibility: "hidden" });
    expect(slot?.textContent?.trim()).toBe("");
  });

  it("keeps the number slot for a named artist", () => {
    const { container } = renderWithProviders(
      inModernTheme(<ArtistAvatar artist={artist("RO", 12)} entry={3} format="CD" />)
    );
    expect(container.textContent).toContain("12");
  });
});
