import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Button } from "@mui/joy";
import Appbar, { APPBAR_HEIGHT_PX } from "@/src/components/shared/Theme/Appbar";

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

  it("takes its height from APPBAR_HEIGHT_PX, which content clearing it relies on", () => {
    render(<Appbar experience="modern" />);
    const root = document.querySelector(".ignoreClassic")!;
    expect(getComputedStyle(root).minHeight).toBe(`${APPBAR_HEIGHT_PX}px`);
  });

  it("is as tall as APPBAR_HEIGHT_PX says: the button group its size sets", () => {
    render(<Appbar experience="modern" />);
    const group = document.querySelector(".ignoreClassic")!.firstElementChild!;

    // The group's own box is its buttons', which jsdom cannot lay out (and the Appbar test mocks them), so read the minimum height Joy itself gives a button of the group's size: `var(--Button-minHeight, <fallback>)`.
    const size = [...group.classList].find((c) => c.startsWith("MuiButtonGroup-size"))!.replace("MuiButtonGroup-size", "").toLowerCase() as "sm" | "md" | "lg";
    const probe = render(<Button size={size}>probe</Button>);
    const minHeight = getComputedStyle(probe.getByRole("button")).minHeight;
    const buttonHeightPx = parseFloat(minHeight.match(/,\s*([\d.]+)rem\)/)![1]) * 16;

    expect(APPBAR_HEIGHT_PX).toBe(buttonHeightPx);
  });

  it("carries no version line", () => {
    render(<Appbar experience="modern" />);
    expect(screen.queryByText(/WXYC DJ Site/)).not.toBeInTheDocument();
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
