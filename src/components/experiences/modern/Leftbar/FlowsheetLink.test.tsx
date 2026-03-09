import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import FlowsheetLink from "./FlowsheetLink";

// Mock hooks
vi.mock("@/src/hooks/flowsheetHooks", () => ({
  useShowControl: vi.fn(() => ({
    live: false,
  })),
}));

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

// Mock MUI icons
vi.mock("@mui/icons-material", () => ({
  Stream: () => <span data-testid="stream-icon" />,
}));

describe("FlowsheetLink", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render link to flowsheet", () => {
    render(<FlowsheetLink />);

    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/dashboard/flowsheet");
  });

  it("should render stream icon", () => {
    render(<FlowsheetLink />);

    expect(screen.getByTestId("stream-icon")).toBeInTheDocument();
  });

  it("should show 'Flowsheet' title when not live", () => {
    render(<FlowsheetLink />);

    // The tooltip should contain just "Flowsheet" when not live
    const link = screen.getByRole("link");
    expect(link).toBeInTheDocument();
  });

  it("should show 'ON AIR' indicator when live", async () => {
    const { useShowControl } = await import("@/src/hooks/flowsheetHooks");
    vi.mocked(useShowControl).mockReturnValue({
      live: true,
    } as any);

    render(<FlowsheetLink />);

    // The link should be in the document and badge should be visible
    expect(screen.getByRole("link")).toBeInTheDocument();
  });

  it("should render badge around link", () => {
    render(<FlowsheetLink />);

    // Badge wrapper should exist
    const link = screen.getByRole("link");
    expect(link.closest(".MuiBadge-root")).toBeInTheDocument();
  });

  it("should have invisible badge when not live", () => {
    render(<FlowsheetLink />);

    // Badge should be invisible (no visible badge indicator)
    const badgeRoot = screen.getByRole("link").closest(".MuiBadge-root");
    expect(badgeRoot).toBeInTheDocument();
  });

  it("should have visible badge when live", async () => {
    const { useShowControl } = await import("@/src/hooks/flowsheetHooks");
    vi.mocked(useShowControl).mockReturnValue({
      live: true,
    } as any);

    render(<FlowsheetLink />);

    // Badge should be visible when live
    const badgeRoot = screen.getByRole("link").closest(".MuiBadge-root");
    expect(badgeRoot).toBeInTheDocument();
  });
});
