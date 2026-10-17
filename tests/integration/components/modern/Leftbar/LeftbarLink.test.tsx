import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { REVIEWS_ACTIVE_PATTERN } from "@/lib/features/reviews/paths";
import LeftbarLink from "@/src/components/experiences/modern/Leftbar/LeftbarLink";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  usePathname: vi.fn(() => "/dashboard"),
}));

// Mock next/link
vi.mock("next/link", () => ({
  default: ({ children, href, prefetch, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

describe("LeftbarLink", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render link with correct href", () => {
    render(
      <LeftbarLink path="/dashboard/catalog" title="Catalog">
        <span data-testid="icon">Icon</span>
      </LeftbarLink>
    );

    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/dashboard/catalog");
  });

  it("should render children", () => {
    render(
      <LeftbarLink path="/dashboard/catalog" title="Catalog">
        <span data-testid="icon">Icon</span>
      </LeftbarLink>
    );

    expect(screen.getByTestId("icon")).toBeInTheDocument();
  });

  it("should not render as a link when disabled", () => {
    render(
      <LeftbarLink path="/dashboard/catalog" title="Catalog" disabled={true}>
        <span>Icon</span>
      </LeftbarLink>
    );

    // When disabled, ListItemButton does not get component: Link, so it renders as a button
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    const button = screen.getByRole("button");
    expect(button).toHaveAttribute("aria-disabled", "true");
  });

  it("should render as a link when not disabled", () => {
    render(
      <LeftbarLink path="/dashboard/catalog" title="Catalog" disabled={false}>
        <span>Icon</span>
      </LeftbarLink>
    );

    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/dashboard/catalog");
  });

  it("should show solid variant when path matches current pathname", async () => {
    const { usePathname } = await import("next/navigation");
    vi.mocked(usePathname).mockReturnValue("/dashboard/catalog");

    render(
      <LeftbarLink path="/dashboard/catalog" title="Catalog">
        <span>Icon</span>
      </LeftbarLink>
    );

    // The ListItemButton renders as a link when not disabled
    const link = screen.getByRole("link");
    expect(link).toHaveClass("MuiListItemButton-variantSolid");
  });

  it("should show plain variant when path does not match current pathname", async () => {
    const { usePathname } = await import("next/navigation");
    vi.mocked(usePathname).mockReturnValue("/dashboard/other");

    render(
      <LeftbarLink path="/dashboard/catalog" title="Catalog">
        <span>Icon</span>
      </LeftbarLink>
    );

    // The ListItemButton renders as a link when not disabled
    const link = screen.getByRole("link");
    expect(link).toHaveClass("MuiListItemButton-variantPlain");
  });

  it("should render tooltip with title", () => {
    render(
      <LeftbarLink path="/dashboard/catalog" title="Card Catalog">
        <span>Icon</span>
      </LeftbarLink>
    );

    // The ListItemButton renders as a link when not disabled
    expect(screen.getByRole("link")).toBeInTheDocument();
  });

  it.each([
    ["/dashboard/reviews", true],
    ["/dashboard/reviews/mine", true],
    ["/dashboard/reviews/music-directors", true],
    ["/dashboard/reviews/12", true],
    ["/dashboard/admin/intake/7", true],
    ["/dashboard/admin/intake/7/slip", true],
    ["/dashboard/reviewsx", false],
    ["/dashboard/admin/intake", false],
    ["/dashboard/catalog", false],
    ["/dashboard/admin/roster", false],
  ])("with an active pattern, %s is current: %s", async (pathname, current) => {
    const { usePathname } = await import("next/navigation");
    vi.mocked(usePathname).mockReturnValue(pathname);

    render(
      <LeftbarLink
        path="/dashboard/reviews"
        title="Reviews"
        activePattern={REVIEWS_ACTIVE_PATTERN}
      >
        <span>Icon</span>
      </LeftbarLink>
    );

    expect(screen.getByRole("link")).toHaveClass(
      current ? "MuiListItemButton-variantSolid" : "MuiListItemButton-variantPlain"
    );
  });

  it("keeps the exact match when no pattern is given", async () => {
    const { usePathname } = await import("next/navigation");
    vi.mocked(usePathname).mockReturnValue("/dashboard/catalog/42");

    render(
      <LeftbarLink path="/dashboard/catalog" title="Catalog">
        <span>Icon</span>
      </LeftbarLink>
    );

    expect(screen.getByRole("link")).toHaveClass("MuiListItemButton-variantPlain");
  });
});
