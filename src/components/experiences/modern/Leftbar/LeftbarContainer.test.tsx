import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import LeftbarContainer from "./LeftbarContainer";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  usePathname: vi.fn(() => "/dashboard"),
}));

// Mock Logo component
vi.mock("@/src/components/shared/Branding/Logo", () => ({
  default: ({ color }: any) => (
    <div data-testid="logo" data-color={color}>
      Logo
    </div>
  ),
}));

describe("LeftbarContainer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render children", () => {
    render(
      <LeftbarContainer>
        <div data-testid="child-content">Child Content</div>
      </LeftbarContainer>
    );

    expect(screen.getByTestId("child-content")).toBeInTheDocument();
  });

  it("should render logo", () => {
    render(
      <LeftbarContainer>
        <div>Content</div>
      </LeftbarContainer>
    );

    expect(screen.getByTestId("logo")).toBeInTheDocument();
  });

  it("should have FirstSidebar class", () => {
    render(
      <LeftbarContainer>
        <div>Content</div>
      </LeftbarContainer>
    );

    const container = document.querySelector(".FirstSidebar");
    expect(container).toBeInTheDocument();
  });

  it("should use primary color for non-admin paths", () => {
    render(
      <LeftbarContainer>
        <div>Content</div>
      </LeftbarContainer>
    );

    expect(screen.getByTestId("logo")).toHaveAttribute("data-color", "primary");
  });

  it("should use success color for admin paths", async () => {
    const { usePathname } = await import("next/navigation");
    vi.mocked(usePathname).mockReturnValue("/dashboard/admin/roster");

    render(
      <LeftbarContainer>
        <div>Content</div>
      </LeftbarContainer>
    );

    expect(screen.getByTestId("logo")).toHaveAttribute("data-color", "success");
  });

  it("should render multiple children", () => {
    render(
      <LeftbarContainer>
        <div data-testid="child-1">Child 1</div>
        <div data-testid="child-2">Child 2</div>
      </LeftbarContainer>
    );

    expect(screen.getByTestId("child-1")).toBeInTheDocument();
    expect(screen.getByTestId("child-2")).toBeInTheDocument();
  });

  it("should render as Sheet component", () => {
    render(
      <LeftbarContainer>
        <div data-testid="content">Content</div>
      </LeftbarContainer>
    );

    const container = document.querySelector(".MuiSheet-root");
    expect(container).toBeInTheDocument();
  });
});
