import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import Appbar from "@/src/components/shared/Theme/Appbar";

// Mock dependencies
vi.mock("@/src/hooks/usePublicRoutes", () => ({
  usePublicRoutes: vi.fn(() => false),
}));

vi.mock("next/dynamic", () => ({
  default: () => () => null,
}));

vi.mock("@/src/components/shared/Theme/ThemeSwitcher", () => ({
  default: () => <span data-testid="theme-switcher">Theme Switcher</span>,
}));

vi.mock("@/src/components/shared/Theme/ThemePicker", () => ({
  default: () => <span data-testid="theme-picker">Theme Picker</span>,
}));

vi.mock("@/src/components/shared/General/LinkButton", () => ({
  LinkButton: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href} data-testid="link-button">
      {children}
    </a>
  ),
}));

describe("Appbar", () => {
  it("should render the component", () => {
    render(<Appbar experience="modern" />);
    expect(document.querySelector(".ignoreClassic")).toBeInTheDocument();
  });

  it("should render version text", () => {
    render(<Appbar experience="modern" />);
    expect(screen.getByText(/WXYC DJ Site/)).toBeInTheDocument();
  });

  it("should render ThemeSwitcher", () => {
    render(<Appbar experience="modern" />);
    expect(screen.getByTestId("theme-switcher")).toBeInTheDocument();
  });

  it("should show General Feedback link for authenticated users", () => {
    render(<Appbar experience="modern" />);
    expect(screen.getByText("General Feedback")).toBeInTheDocument();
  });
});

describe("Appbar when on public route", () => {
  it("should show Log In link for public routes", async () => {
    const { usePublicRoutes } = await import("@/src/hooks/usePublicRoutes");
    vi.mocked(usePublicRoutes).mockReturnValue(true);

    render(<Appbar experience="modern" />);
    expect(screen.getByText("Log In")).toBeInTheDocument();
  });
});
