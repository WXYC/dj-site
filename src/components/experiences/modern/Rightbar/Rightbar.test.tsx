import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import Rightbar from "./Rightbar";

// Mock child components
vi.mock("./RightbarMobileClose", () => ({
  default: () => <div data-testid="rightbar-mobile-close">Mobile Close</div>,
}));

vi.mock("./RightbarContainer", () => ({
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="rightbar-container">{children}</div>
  ),
}));

vi.mock("./NowPlayingContent", () => ({
  default: () => <div data-testid="now-playing-content">Now Playing</div>,
}));

vi.mock("./Bin/BinContent", () => ({
  default: () => <div data-testid="bin-content">Bin Content</div>,
}));

// Mock MUI components
vi.mock("@mui/joy", () => ({
  Box: ({ children, sx }: { children?: React.ReactNode; sx?: any }) => (
    <div data-testid="box" style={{ minHeight: sx?.minHeight }}>
      {children}
    </div>
  ),
  Divider: () => <hr data-testid="divider" />,
}));

// Mock NowPlaying widget (although it's not directly used in Rightbar.tsx - checking import path)
vi.mock("@/src/widgets/NowPlaying", () => ({
  default: () => <div data-testid="now-playing-widget">Widget</div>,
}));

describe("Rightbar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render the rightbar mobile close component", () => {
    render(<Rightbar />);

    expect(screen.getByTestId("rightbar-mobile-close")).toBeInTheDocument();
  });

  it("should render the rightbar container", () => {
    render(<Rightbar />);

    expect(screen.getByTestId("rightbar-container")).toBeInTheDocument();
  });

  it("should render now playing content", () => {
    render(<Rightbar />);

    expect(screen.getByTestId("now-playing-content")).toBeInTheDocument();
  });

  it("should render bin content", () => {
    render(<Rightbar />);

    expect(screen.getByTestId("bin-content")).toBeInTheDocument();
  });

  it("should render dividers between sections", () => {
    render(<Rightbar />);

    const dividers = screen.getAllByTestId("divider");
    expect(dividers.length).toBe(2);
  });

  it("should render an empty box at the bottom", () => {
    render(<Rightbar />);

    const box = screen.getByTestId("box");
    expect(box).toBeInTheDocument();
  });

  it("should render mobile close before container", () => {
    render(<Rightbar />);

    const mobileClose = screen.getByTestId("rightbar-mobile-close");
    const container = screen.getByTestId("rightbar-container");

    // Mobile close should be before container in DOM order
    expect(mobileClose.compareDocumentPosition(container)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    );
  });

  it("should render components in correct order within container", () => {
    render(<Rightbar />);

    const container = screen.getByTestId("rightbar-container");
    const children = container.children;

    // Order: NowPlayingContent, Divider, BinContent, Divider, Box
    expect(children[0]).toHaveAttribute("data-testid", "now-playing-content");
    expect(children[1]).toHaveAttribute("data-testid", "divider");
    expect(children[2]).toHaveAttribute("data-testid", "bin-content");
    expect(children[3]).toHaveAttribute("data-testid", "divider");
    expect(children[4]).toHaveAttribute("data-testid", "box");
  });

  it("should render both mobile close and container", () => {
    render(<Rightbar />);

    // Should have mobile close and rightbar container
    expect(screen.getByTestId("rightbar-mobile-close")).toBeInTheDocument();
    expect(screen.getByTestId("rightbar-container")).toBeInTheDocument();
  });

  it("should render box with minimum height for spacing", () => {
    render(<Rightbar />);

    const box = screen.getByTestId("box");
    expect(box).toHaveStyle({ minHeight: "65px" });
  });

  it("should render all expected sections", () => {
    render(<Rightbar />);

    // Verify all major sections are present
    expect(screen.getByTestId("rightbar-mobile-close")).toBeInTheDocument();
    expect(screen.getByTestId("rightbar-container")).toBeInTheDocument();
    expect(screen.getByTestId("now-playing-content")).toBeInTheDocument();
    expect(screen.getByTestId("bin-content")).toBeInTheDocument();
    expect(screen.getAllByTestId("divider")).toHaveLength(2);
    expect(screen.getByTestId("box")).toBeInTheDocument();
  });
});
