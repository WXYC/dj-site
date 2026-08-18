import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/tests/helpers";

// Mock fonts before importing the modern theme (pulled in for the format palette slots).
vi.mock("next/font/google", () => ({
  Kanit: () => ({ style: { fontFamily: "Kanit, sans-serif" } }),
}));
vi.mock("next/font/local", () => ({
  default: () => ({ style: { fontFamily: "Minbus, sans-serif" } }),
}));

import { CssVarsProvider } from "@mui/joy/styles";
import type { ReactElement } from "react";
import modernTheme from "@/lib/features/experiences/modern/theme";
import CatalogCodePreview from "@/src/components/experiences/modern/catalog/CatalogCodePreview";

// The inner format chip uses the custom formatVinyl/formatCd palette slots,
// which only resolve under the modern theme.
const inModernTheme = (ui: ReactElement) => (
  <CssVarsProvider theme={modernTheme}>{ui}</CssVarsProvider>
);

describe("CatalogCodePreview", () => {
  it("renders placeholders when the draft is empty", () => {
    const { container } = renderWithProviders(
      inModernTheme(<CatalogCodePreview
        genreName={null}
        codeLetters=""
        artistNumber={null}
        albumEntry={null}
        formatLabel={null}
      />
      )
    );
    expect(container.textContent).toContain("&&");
    expect(container.textContent).toContain("?");
    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(1);
  });

  it("renders the compact avatar when size is sm", () => {
    const { container } = renderWithProviders(
      inModernTheme(<CatalogCodePreview
        genreName="Rock"
        codeLetters="RO"
        artistNumber={87}
        albumEntry="4"
        formatLabel="Vinyl"
        size="sm"
      />
      )
    );
    // jsdom computes the sx rem values to px (16px root): sm outer = 2.5rem.
    const avatar = container.querySelector(".MuiAvatar-root");
    expect(avatar).toHaveStyle({ width: "40px", height: "40px" });
  });

  it("shows the artist number, letters, entry, and format abbreviation", () => {
    const { container } = renderWithProviders(
      inModernTheme(<CatalogCodePreview
        genreName="Jazz"
        codeLetters="el"
        artistNumber={87}
        albumEntry="4"
        formatLabel="Vinyl"
      />
      )
    );
    expect(screen.getByText("87")).toBeInTheDocument();
    expect(screen.getByText("EL")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
    expect(container.textContent).toContain("VI");
  });

  it("resolves genre tones case-insensitively", () => {
    const upper = renderWithProviders(
      inModernTheme(<CatalogCodePreview
        genreName="Rock"
        codeLetters="RO"
        artistNumber={1}
        albumEntry={1}
        formatLabel="CD"
      />
      )
    ).container.querySelector(".MuiAvatar-root")!.className;
    const lower = renderWithProviders(
      inModernTheme(<CatalogCodePreview
        genreName="rock"
        codeLetters="RO"
        artistNumber={1}
        albumEntry={1}
        formatLabel="CD"
      />
      )
    ).container.querySelector(".MuiAvatar-root")!.className;
    expect(lower).toBe(upper);
  });

  it("renders the rotation badge only when a rotation is given", () => {
    const { container } = renderWithProviders(
      inModernTheme(<CatalogCodePreview
        genreName="Rock"
        codeLetters="RO"
        artistNumber={87}
        albumEntry="4"
        formatLabel="CD"
        rotation="H"
      />
      )
    );
    expect(container.textContent).toContain("H");

    const { container: without } = renderWithProviders(
      inModernTheme(<CatalogCodePreview
        genreName="Jazz"
        codeLetters="EL"
        artistNumber={5}
        albumEntry="1"
        formatLabel="CD"
      />
      )
    );
    const badge = without.querySelector(".MuiBadge-badge");
    expect(badge?.textContent ?? "").toBe("");
  });
});
