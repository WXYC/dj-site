import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/tests/helpers";
import {
  BackgroundImage,
  BackgroundBox,
} from "@/src/components/experiences/modern/login/Layout/Background";

describe("Background", () => {
  describe("BackgroundImage", () => {
    it("should render a Box element", () => {
      const { container } = renderWithProviders(<BackgroundImage />);

      expect(container.querySelector(".MuiBox-root")).toBeInTheDocument();
    });

    it("should have fixed positioning", () => {
      const { container } = renderWithProviders(<BackgroundImage />);

      const box = container.querySelector(".MuiBox-root");
      expect(box).toHaveStyle({ position: "fixed" });
    });

    // The sx is a function here (client component), so invoke it with a theme
    // stub to read the resolved values off the object rather than the DOM.
    it("uses the optimized WebP backgrounds, light and dark, with no PNG/JPEG", () => {
      const sxFn = (
        BackgroundImage() as {
          props: { sx: (theme: { getColorSchemeSelector: (s: string) => string }) => Record<string, unknown> };
        }
      ).props.sx;
      const darkSelector = '[data-joy-color-scheme="dark"] &';
      const sx = sxFn({ getColorSchemeSelector: () => darkSelector });

      expect(sx.backgroundImage).toBe('url("/img/wxyc_color.webp")');
      expect(
        (sx[darkSelector] as { backgroundImage: string }).backgroundImage
      ).toBe('url("/img/wxyc_dark.webp")');

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

    it("should render nested Box elements", () => {
      const { container } = renderWithProviders(
        <BackgroundBox>
          <span>Content</span>
        </BackgroundBox>
      );

      const boxes = container.querySelectorAll(".MuiBox-root");
      expect(boxes.length).toBeGreaterThanOrEqual(1);
    });
  });
});
