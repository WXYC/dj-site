import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import Header from "./Header";

// Mock the Logo component
vi.mock("@/src/components/shared/Branding/Logo", () => ({
  default: () => <div data-testid="logo">Logo</div>,
}));

// Mock the dynamic import for ColorSchemeToggle
vi.mock("next/dynamic", () => ({
  default: () => () => null,
}));

describe("Header", () => {
  it("should render header element", () => {
    render(<Header />);
    expect(document.querySelector("header")).toBeInTheDocument();
  });

  it("should render Logo component", () => {
    render(<Header />);
    expect(screen.getByTestId("logo")).toBeInTheDocument();
  });
});
