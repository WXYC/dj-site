import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import type { SpecialtyShowRef } from "@wxyc/shared";
import SpecialtyTile from "@/src/components/experiences/modern/SpecialtyTile";

const SIZE = 48;

const baseSpecialty: SpecialtyShowRef = {
  id: 1,
  slug: "sunset-soundtrack",
  name: "Sunset Soundtrack",
  short_name: "Sunset Soundtrack",
  logs_playcuts: true,
  accent_color: "#7a1f3d",
};

describe("SpecialtyTile", () => {
  it("renders artwork as a lazy, decorative img carrying real width and height attributes", () => {
    const { container } = render(
      <SpecialtyTile
        specialty={{
          ...baseSpecialty,
          artwork: {
            square_url: "https://example.com/sunset-soundtrack.png",
          } as SpecialtyShowRef["artwork"],
        }}
        size={SIZE}
      />,
    );

    const img = container.querySelector("img");
    expect(img).not.toBeNull();
    expect(img).toHaveAttribute("src", "https://example.com/sunset-soundtrack.png");
    expect(img).toHaveAttribute("loading", "lazy");
    expect(img).toHaveAttribute("width", String(SIZE));
    expect(img).toHaveAttribute("height", String(SIZE));
    expect(img).toHaveAttribute("alt", "");
  });

  it("renders the bare accent square, with no text, initials, or ellipsis, for a name too long to fit at the minimum size", () => {
    render(
      <SpecialtyTile
        specialty={{
          ...baseSpecialty,
          short_name: "Supercalifragilisticexpialidocious",
        }}
        size={SIZE}
      />,
    );

    const tile = screen.getByTestId("specialty-tile");
    expect(tile).toBeEmptyDOMElement();
    expect(tile.textContent).toBe("");
    expect(tile.textContent).not.toContain("…");
    expect(tile.textContent).not.toContain("...");
    expect(tile).toHaveStyle({ backgroundColor: "#7a1f3d" });
  });
});
