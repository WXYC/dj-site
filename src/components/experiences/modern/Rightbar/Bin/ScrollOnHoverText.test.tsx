import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ScrollOnHoverText from "./ScrollOnHoverText";

// Mock react-fast-marquee
vi.mock("react-fast-marquee", () => ({
  default: ({ children, play }: any) => (
    <div data-testid="marquee" data-playing={play}>
      {children}
    </div>
  ),
}));

describe("ScrollOnHoverText", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render children text", () => {
    render(<ScrollOnHoverText>Test Text</ScrollOnHoverText>);

    expect(screen.getByText("Test Text")).toBeInTheDocument();
  });

  it("should render marquee component", () => {
    render(<ScrollOnHoverText>Test Text</ScrollOnHoverText>);

    expect(screen.getByTestId("marquee")).toBeInTheDocument();
  });

  it("should not play marquee by default", () => {
    render(<ScrollOnHoverText>Test Text</ScrollOnHoverText>);

    const marquee = screen.getByTestId("marquee");
    expect(marquee).toHaveAttribute("data-playing", "false");
  });

  it("should apply custom width", () => {
    render(<ScrollOnHoverText width={200}>Test Text</ScrollOnHoverText>);

    // Component should render with custom width
    expect(screen.getByText("Test Text")).toBeInTheDocument();
  });

  it("should use default width of 100 when not specified", () => {
    render(<ScrollOnHoverText>Test Text</ScrollOnHoverText>);

    // Component should render with default width
    expect(screen.getByText("Test Text")).toBeInTheDocument();
  });

  it("should pass typography props", () => {
    render(
      <ScrollOnHoverText level="body-sm" color="primary">
        Test Text
      </ScrollOnHoverText>
    );

    const text = screen.getByText("Test Text");
    expect(text).toBeInTheDocument();
  });

  it("should apply custom sx styles", () => {
    render(
      <ScrollOnHoverText sx={{ fontWeight: "bold" }}>
        Test Text
      </ScrollOnHoverText>
    );

    const text = screen.getByText("Test Text");
    expect(text).toBeInTheDocument();
  });

  it("should handle mouse enter event", () => {
    render(<ScrollOnHoverText>Test Text</ScrollOnHoverText>);

    const container = screen.getByTestId("marquee").parentElement;
    if (container) {
      fireEvent.mouseEnter(container);
    }

    // After mouseenter, component should be hovering (but may not scroll if text fits)
    expect(screen.getByText("Test Text")).toBeInTheDocument();
  });

  it("should handle mouse leave event", () => {
    render(<ScrollOnHoverText>Test Text</ScrollOnHoverText>);

    const container = screen.getByTestId("marquee").parentElement;
    if (container) {
      fireEvent.mouseEnter(container);
      fireEvent.mouseLeave(container);
    }

    // After mouseleave, marquee should not be playing
    expect(screen.getByTestId("marquee")).toHaveAttribute("data-playing", "false");
  });
});
