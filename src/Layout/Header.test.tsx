import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import Header from "./Header";

// Mock Logo component
vi.mock("@/src/components/shared/Branding/Logo", () => ({
  default: () => <div data-testid="logo">Logo</div>,
}));

// Mock dynamic import of ColorSchemeToggle
vi.mock("next/dynamic", () => ({
  default: () => () => <div data-testid="color-scheme-toggle">Toggle</div>,
}));

describe("Header", () => {
  it("should render as header element", () => {
    render(<Header />);

    expect(screen.getByRole("banner")).toBeInTheDocument();
  });

  it("should render Logo component", () => {
    render(<Header />);

    expect(screen.getByTestId("logo")).toBeInTheDocument();
  });

  it("should have MuiBox class", () => {
    render(<Header />);

    const header = screen.getByRole("banner");
    expect(header).toHaveClass("MuiBox-root");
  });
});
