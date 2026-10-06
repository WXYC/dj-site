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

const artist = (
  lettercode: string,
  numbercode: number,
  genre = "Rock",
  genre_id: number | undefined = undefined,
  code_comp_letter: string | null = null,
): ArtistEntry => ({
  name: "Juana Molina",
  lettercode,
  numbercode,
  genre,
  genre_id,
  code_comp_letter,
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
    // Exactly one NBSP: an empty slot collapses the layout this test guards.
    expect(slot?.textContent).toBe("\u00a0");
  });

  it("keeps the number slot for a named artist", () => {
    const { container } = renderWithProviders(
      inModernTheme(<ArtistAvatar artist={artist("RO", 12)} entry={3} format="CD" />)
    );
    expect(container.textContent).toContain("12");
  });

  it.each([
    ["Rock + M", artist("V/A", 0, "Rock", 11, "M"), "Rock CD ♪ V/A M-651"],
    ["Soundtracks + M", artist("V/A", 0, "Soundtracks", 12, "M"), "Soundtracks CD ♪ M-651"],
    ["Rock, no genre id", artist("V/A", 0, "Rock", undefined, "M"), "Rock CD ♪ V/A-651"],
  ])("threads the section letter into the tooltip: %s", (_, a, title) => {
    renderWithProviders(inModernTheme(<ArtistAvatar artist={a} entry={651} format="CD" />));
    expect(screen.getByLabelText(title)).toBeInTheDocument();
  });

  it("shows the section letter in the number slot of a Rock compilation", () => {
    const { container } = renderWithProviders(
      inModernTheme(<ArtistAvatar artist={artist("V/A", 0, "Rock", 11, "M")} entry={121} format="CD" />)
    );
    expect(container.querySelector('[aria-hidden="true"].MuiTypography-root')).toBeNull();
    expect(screen.getByText("M")).toBeVisible();
  });

  it("keeps the slot hidden for a compilation in another genre despite a letter", () => {
    const { container } = renderWithProviders(
      inModernTheme(<ArtistAvatar artist={artist("V/A", 0, "Hiphop", 7, "M")} entry={651} format="CD" />)
    );
    expect(container.querySelector('[aria-hidden="true"].MuiTypography-root')?.textContent).toBe("\u00a0");
  });
});
