import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import AppbarClassic from "@/src/components/shared/Theme/AppbarClassic";

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

vi.mock("@/src/components/shared/General/LinkButton", () => ({
  LinkButton: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href} data-testid="link-button">
      {children}
    </a>
  ),
}));

describe("AppbarClassic", () => {
  it("carries no version line", () => {
    render(<AppbarClassic experience="classic" />);
    expect(screen.queryByText(/WXYC DJ Site/)).not.toBeInTheDocument();
  });

  it("should render ThemeSwitcher", () => {
    render(<AppbarClassic experience="classic" />);
    expect(screen.getByTestId("theme-switcher")).toBeInTheDocument();
  });

  it("should not render a ThemePicker", () => {
    // Unlike Appbar.tsx, AppbarClassic intentionally omits the color-theme
    // picker: classic mode has no ThemePicker import at all.
    render(<AppbarClassic experience="classic" />);
    expect(screen.queryByTestId("theme-picker")).not.toBeInTheDocument();
  });

  it("should show the General Feedback link, and no Beta Tester Form, for authenticated users", () => {
    render(<AppbarClassic experience="classic" />);
    expect(screen.getByText("General Feedback")).toBeInTheDocument();
    expect(screen.queryByText("Beta Tester Form")).not.toBeInTheDocument();
  });
});

describe("AppbarClassic when on public route", () => {
  it("should show Log In link for public routes", async () => {
    const { usePublicRoutes } = await import("@/src/hooks/usePublicRoutes");
    vi.mocked(usePublicRoutes).mockReturnValue(true);

    render(<AppbarClassic experience="classic" />);
    expect(screen.getByText("Log In")).toBeInTheDocument();
  });
});
