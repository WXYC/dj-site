import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import Logo from "./Logo";

describe("Logo", () => {
  it("should render an SVG element", () => {
    const { container } = render(<Logo />);
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("should have 100% width and height", () => {
    const { container } = render(<Logo />);
    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("width", "100%");
    expect(svg).toHaveAttribute("height", "100%");
  });

  it("should have correct viewBox", () => {
    const { container } = render(<Logo />);
    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("viewBox", "0 0 280.000000 280.000000");
  });

  it("should use primary color by default", () => {
    const { container } = render(<Logo />);
    const g = container.querySelector("g");
    expect(g).toHaveAttribute(
      "fill",
      "var(--wxyc-palette-primary-solidBg, var(--wxyc-palette-primary-500, #096BDE))"
    );
  });

  it("should use custom color when provided", () => {
    const { container } = render(<Logo color="success" />);
    const g = container.querySelector("g");
    expect(g).toHaveAttribute(
      "fill",
      "var(--wxyc-palette-success-solidBg, var(--wxyc-palette-success-500, #096BDE))"
    );
  });

  it("should contain path elements", () => {
    const { container } = render(<Logo />);
    const paths = container.querySelectorAll("path");
    expect(paths.length).toBeGreaterThan(0);
  });

  it("should preserve aspect ratio", () => {
    const { container } = render(<Logo />);
    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("preserveAspectRatio", "xMidYMid meet");
  });
});
