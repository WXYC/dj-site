import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { extendTheme } from "@mui/joy/styles";
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

  it("is as tall as APPBAR_HEIGHT_PX says: the version line adds no block padding to the line its level sets, over the button group its size sets", () => {
    render(<Appbar experience="modern" />);
    const line = screen.getByText(/WXYC DJ Site/);
    expect(getComputedStyle(line)).toMatchObject({ paddingTop: "0px", paddingBottom: "0px" });

    // jsdom leaves Joy's custom properties unresolved, so resolve them from the same theme the Appbar renders under.
    const theme = extendTheme() as unknown as Record<string, Record<string, string | number | Record<string, string | number>>>;
    const resolve = (value: string | number) => {
      const named = String(value).match(/^var\(--joy-(\w+)-(\w+)/);
      return named ? (theme[named[1]][named[2]] as string | number) : value;
    };
    const level = [...line.classList].find((c) => c.startsWith("MuiTypography-body") || c.startsWith("MuiTypography-title") || c.startsWith("MuiTypography-h"))!.replace("MuiTypography-", "");
    const typography = theme.typography[level] as Record<string, string | number>;
    // The rendered line carries the level's own font size and line height, so the level is what the height is derived from.
    expect(getComputedStyle(line).fontSize).toContain(String(typography.fontSize));
    expect(getComputedStyle(line).lineHeight).toContain(String(typography.lineHeight));
    const fontSizePx = parseFloat(String(resolve(typography.fontSize))) * 16;
    const lineHeightPx = fontSizePx * Number(resolve(typography.lineHeight));

    // The group's own box is its buttons', which jsdom cannot lay out (and the Appbar test mocks them), so its size class is read from the render and mapped to Joy's small and medium button heights (2rem and 2.5rem).
    const group = line.nextElementSibling!;
    const size = [...group.classList].find((c) => c.startsWith("MuiButtonGroup-size"))!.replace("MuiButtonGroup-size", "").toLowerCase();
    const buttonHeightPx = { sm: 2 * 16, md: 2.5 * 16, lg: 3 * 16 }[size]!;

    expect(APPBAR_HEIGHT_PX).toBe(lineHeightPx + buttonHeightPx);
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
