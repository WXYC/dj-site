import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { BackgroundImage, BackgroundBox } from "./Background";

describe("Background", () => {
  describe("BackgroundImage", () => {
    it("should render a Box element", () => {
      const { container } = render(<BackgroundImage />);

      // Should render a Box (div)
      expect(container.querySelector(".MuiBox-root")).toBeInTheDocument();
    });

    it("should have fixed positioning", () => {
      const { container } = render(<BackgroundImage />);

      const box = container.querySelector(".MuiBox-root");
      expect(box).toHaveStyle({ position: "fixed" });
    });
  });

  describe("BackgroundBox", () => {
    it("should render children", () => {
      render(
        <BackgroundBox>
          <div data-testid="child-content">Test Content</div>
        </BackgroundBox>
      );

      expect(screen.getByTestId("child-content")).toBeInTheDocument();
    });

    it("should render multiple children", () => {
      render(
        <BackgroundBox>
          <div data-testid="child-1">Child 1</div>
          <div data-testid="child-2">Child 2</div>
        </BackgroundBox>
      );

      expect(screen.getByTestId("child-1")).toBeInTheDocument();
      expect(screen.getByTestId("child-2")).toBeInTheDocument();
    });

    it("should render nested Box elements", () => {
      const { container } = render(
        <BackgroundBox>
          <span>Content</span>
        </BackgroundBox>
      );

      const boxes = container.querySelectorAll(".MuiBox-root");
      expect(boxes.length).toBeGreaterThanOrEqual(1);
    });
  });
});
