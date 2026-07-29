import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/tests/helpers";
import { BackgroundImage, BackgroundBox } from "@/src/Layout/Background";

describe("Background", () => {
  describe("BackgroundImage", () => {
    it("should render a Box element", () => {
      const { container } = renderWithProviders(<BackgroundImage />);

      expect(container.querySelector(".MuiBox-root")).toBeInTheDocument();
    });

    it("should have fixed positioning style", () => {
      const { container } = renderWithProviders(<BackgroundImage />);

      const box = container.querySelector(".MuiBox-root");
      expect(box).toHaveStyle({ position: "fixed" });
    });

    // The sx is an object here (server component — a function sx can't cross the
    // RSC boundary), so read it off the returned element rather than the DOM
    // (jsdom won't resolve the color-scheme selector or the emotion class).
    it("uses the optimized WebP backgrounds, light and dark, with no PNG/JPEG", () => {
      const sx = (BackgroundImage() as { props: { sx: Record<string, unknown> } })
        .props.sx;

      expect(sx.backgroundImage).toBe('url("/img/wxyc_color.webp")');

      const darkKey = Object.keys(sx).find((k) =>
        k.includes('data-joy-color-scheme="dark"')
      );
      expect(darkKey).toBeDefined();
      expect((sx[darkKey!] as { backgroundImage: string }).backgroundImage).toBe(
        'url("/img/wxyc_dark.webp")'
      );

      expect(JSON.stringify(sx)).not.toMatch(/\.png|\.jpg/);
    });
  });

  describe("BackgroundBox", () => {
    it("should render children", () => {
      renderWithProviders(
        <BackgroundBox>
          <div data-testid="child-content">Test Content</div>
        </BackgroundBox>
      );

      expect(screen.getByTestId("child-content")).toBeInTheDocument();
    });

    it("should render multiple children", () => {
      renderWithProviders(
        <BackgroundBox>
          <div data-testid="child-1">Child 1</div>
          <div data-testid="child-2">Child 2</div>
        </BackgroundBox>
      );

      expect(screen.getByTestId("child-1")).toBeInTheDocument();
      expect(screen.getByTestId("child-2")).toBeInTheDocument();
    });

    it("should have relative positioning", () => {
      const { container } = renderWithProviders(
        <BackgroundBox>
          <span>Content</span>
        </BackgroundBox>
      );

      const box = container.querySelector(".MuiBox-root");
      expect(box).toHaveStyle({ position: "relative" });
    });
  });
});
