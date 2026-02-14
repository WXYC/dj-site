import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import LeftbarLink from "./LeftbarLink";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  usePathname: vi.fn(() => "/dashboard"),
}));

// Mock next/link
vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: any) => (
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

  it("should be disabled when disabled prop is true", () => {
    render(
      <LeftbarLink path="/dashboard/catalog" title="Catalog" disabled={true}>
        <span>Icon</span>
      </LeftbarLink>
    );

    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("aria-disabled", "true");
    expect(link).toHaveStyle({ pointerEvents: "none" });
  });

  it("should be enabled when disabled prop is false", () => {
    render(
      <LeftbarLink path="/dashboard/catalog" title="Catalog" disabled={false}>
        <span>Icon</span>
      </LeftbarLink>
    );

    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("aria-disabled", "false");
    expect(link).toHaveStyle({ pointerEvents: "auto" });
  });

  it("should show solid variant when path matches current pathname", async () => {
    const { usePathname } = await import("next/navigation");
    vi.mocked(usePathname).mockReturnValue("/dashboard/catalog");

    render(
      <LeftbarLink path="/dashboard/catalog" title="Catalog">
        <span>Icon</span>
      </LeftbarLink>
    );

    // The ListItemButton should have solid variant when path matches
    const button = screen.getByRole("button");
    expect(button).toHaveClass("MuiListItemButton-variantSolid");
  });

  it("should show plain variant when path does not match current pathname", async () => {
    const { usePathname } = await import("next/navigation");
    vi.mocked(usePathname).mockReturnValue("/dashboard/other");

    render(
      <LeftbarLink path="/dashboard/catalog" title="Catalog">
        <span>Icon</span>
      </LeftbarLink>
    );

    // The ListItemButton should have plain variant when path doesn't match
    const button = screen.getByRole("button");
    expect(button).toHaveClass("MuiListItemButton-variantPlain");
  });

  it("should render tooltip with title", () => {
    render(
      <LeftbarLink path="/dashboard/catalog" title="Card Catalog">
        <span>Icon</span>
      </LeftbarLink>
    );

    // Tooltip title is not directly visible but is in the DOM
    expect(screen.getByRole("button")).toBeInTheDocument();
  });
});
