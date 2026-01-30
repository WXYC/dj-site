import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { BackgroundImage, BackgroundBox } from "./Background";

describe("Background components", () => {
  describe("BackgroundImage", () => {
    it("should render without crashing", () => {
      expect(() => render(<BackgroundImage />)).not.toThrow();
    });
  });

  describe("BackgroundBox", () => {
    it("should render children", () => {
      render(
        <BackgroundBox>
          <div data-testid="child">Child content</div>
        </BackgroundBox>
      );

      expect(screen.getByTestId("child")).toBeInTheDocument();
      expect(screen.getByText("Child content")).toBeInTheDocument();
    });

    it("should render multiple children", () => {
      render(
        <BackgroundBox>
          <div data-testid="child1">First</div>
          <div data-testid="child2">Second</div>
        </BackgroundBox>
      );

      expect(screen.getByTestId("child1")).toBeInTheDocument();
      expect(screen.getByTestId("child2")).toBeInTheDocument();
    });
  });
});
