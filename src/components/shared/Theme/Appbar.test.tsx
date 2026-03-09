import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import Appbar from "./Appbar";

// Mock dependencies
vi.mock("@/src/hooks/applicationHooks", () => ({
  usePublicRoutes: vi.fn(() => false),
}));

vi.mock("next/dynamic", () => ({
  default: () => () => null,
}));

vi.mock("./ThemeSwitcher", () => ({
  default: () => <span data-testid="theme-switcher">Theme Switcher</span>,
}));

vi.mock("../General/LinkButton", () => ({
  LinkButton: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href} data-testid="link-button">
      {children}
    </a>
  ),
}));

describe("Appbar", () => {
  it("should render the component", () => {
    render(<Appbar />);
    expect(document.querySelector(".ignoreClassic")).toBeInTheDocument();
  });

  it("should render version text", () => {
    render(<Appbar />);
    expect(screen.getByText(/WXYC DJ Site/)).toBeInTheDocument();
  });

  it("should render ThemeSwitcher", () => {
    render(<Appbar />);
    expect(screen.getByTestId("theme-switcher")).toBeInTheDocument();
  });

  it("should show Beta Tester Form link for authenticated users", () => {
    render(<Appbar />);
    expect(screen.getByText("Beta Tester Form")).toBeInTheDocument();
  });

  it("should show General Feedback link for authenticated users", () => {
    render(<Appbar />);
    expect(screen.getByText("General Feedback")).toBeInTheDocument();
  });
});

describe("Appbar when on public route", () => {
  it("should show Log In link for public routes", async () => {
    const { usePublicRoutes } = await import("@/src/hooks/applicationHooks");
    vi.mocked(usePublicRoutes).mockReturnValue(true);

    render(<Appbar />);
    expect(screen.getByText("Log In")).toBeInTheDocument();
  });
});
