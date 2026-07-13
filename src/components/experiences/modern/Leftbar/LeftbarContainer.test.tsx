import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { CssVarsProvider } from "@mui/joy/styles";
import type { ReactElement } from "react";

// Mock fonts before importing the modern theme (pulled in for the sidebar palette).
vi.mock("next/font/google", () => ({
  Kanit: () => ({ style: { fontFamily: "Kanit, sans-serif" } }),
}));
vi.mock("next/font/local", () => ({
  default: () => ({ style: { fontFamily: "Minbus, sans-serif" } }),
}));

import LeftbarContainer from "./LeftbarContainer";
import modernTheme from "@/lib/features/experiences/modern/theme";

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

// The sidebar Sheet uses the custom `sidebar`/`sidebarAdmin` palette slots +
// `invertedColors`, which only resolve under the modern theme.
function renderInTheme(ui: ReactElement) {
  return render(<CssVarsProvider theme={modernTheme}>{ui}</CssVarsProvider>);
}

describe("LeftbarContainer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render children", () => {
    renderInTheme(
      <LeftbarContainer>
        <div data-testid="child-content">Child Content</div>
      </LeftbarContainer>
    );

    expect(screen.getByTestId("child-content")).toBeInTheDocument();
  });

  it("should render logo", () => {
    renderInTheme(
      <LeftbarContainer>
        <div>Content</div>
      </LeftbarContainer>
    );

    expect(screen.getByTestId("logo")).toBeInTheDocument();
  });

  it("should have FirstSidebar class", () => {
    renderInTheme(
      <LeftbarContainer>
        <div>Content</div>
      </LeftbarContainer>
    );

    const container = document.querySelector(".FirstSidebar");
    expect(container).toBeInTheDocument();
  });

  it("should use the sidebar color for non-admin paths", () => {
    renderInTheme(
      <LeftbarContainer>
        <div>Content</div>
      </LeftbarContainer>
    );

    expect(screen.getByTestId("logo")).toHaveAttribute("data-color", "sidebar");
  });

  it("should use the sidebarAdmin color for admin paths", async () => {
    const { usePathname } = await import("next/navigation");
    vi.mocked(usePathname).mockReturnValue("/dashboard/admin/roster");

    renderInTheme(
      <LeftbarContainer>
        <div>Content</div>
      </LeftbarContainer>
    );

    expect(screen.getByTestId("logo")).toHaveAttribute(
      "data-color",
      "sidebarAdmin"
    );
  });

  it("should render multiple children", () => {
    renderInTheme(
      <LeftbarContainer>
        <div data-testid="child-1">Child 1</div>
        <div data-testid="child-2">Child 2</div>
      </LeftbarContainer>
    );

    expect(screen.getByTestId("child-1")).toBeInTheDocument();
    expect(screen.getByTestId("child-2")).toBeInTheDocument();
  });

  it("should render as Sheet component", () => {
    renderInTheme(
      <LeftbarContainer>
        <div data-testid="content">Content</div>
      </LeftbarContainer>
    );

    const container = document.querySelector(".MuiSheet-root");
    expect(container).toBeInTheDocument();
  });

  describe("admin path detection", () => {
    it("should use sidebarAdmin color for admin schedule path", async () => {
      const { usePathname } = await import("next/navigation");
      vi.mocked(usePathname).mockReturnValue("/dashboard/admin/schedule");

      renderInTheme(
        <LeftbarContainer>
          <div>Content</div>
        </LeftbarContainer>
      );

      expect(screen.getByTestId("logo")).toHaveAttribute(
        "data-color",
        "sidebarAdmin"
      );
    });

    it("should use sidebar color for catalog path", async () => {
      const { usePathname } = await import("next/navigation");
      vi.mocked(usePathname).mockReturnValue("/dashboard/catalog");

      renderInTheme(
        <LeftbarContainer>
          <div>Content</div>
        </LeftbarContainer>
      );

      expect(screen.getByTestId("logo")).toHaveAttribute(
        "data-color",
        "sidebar"
      );
    });

    it("should use sidebar color for flowsheet path", async () => {
      const { usePathname } = await import("next/navigation");
      vi.mocked(usePathname).mockReturnValue("/dashboard/flowsheet");

      renderInTheme(
        <LeftbarContainer>
          <div>Content</div>
        </LeftbarContainer>
      );

      expect(screen.getByTestId("logo")).toHaveAttribute(
        "data-color",
        "sidebar"
      );
    });

    it("should use sidebar color for settings path", async () => {
      const { usePathname } = await import("next/navigation");
      vi.mocked(usePathname).mockReturnValue("/dashboard/settings");

      renderInTheme(
        <LeftbarContainer>
          <div>Content</div>
        </LeftbarContainer>
      );

      expect(screen.getByTestId("logo")).toHaveAttribute(
        "data-color",
        "sidebar"
      );
    });

    it("should use sidebarAdmin color when admin appears anywhere in path", async () => {
      const { usePathname } = await import("next/navigation");
      vi.mocked(usePathname).mockReturnValue("/some/admin/nested/path");

      renderInTheme(
        <LeftbarContainer>
          <div>Content</div>
        </LeftbarContainer>
      );

      expect(screen.getByTestId("logo")).toHaveAttribute(
        "data-color",
        "sidebarAdmin"
      );
    });
  });

  describe("sheet styling", () => {
    it("should render Sheet with soft variant", () => {
      renderInTheme(
        <LeftbarContainer>
          <div>Content</div>
        </LeftbarContainer>
      );

      const container = document.querySelector(".MuiSheet-variantSoft");
      expect(container).toBeInTheDocument();
    });

    it("should render Sheet component with MuiSheet-root class", () => {
      renderInTheme(
        <LeftbarContainer>
          <div>Content</div>
        </LeftbarContainer>
      );

      const container = document.querySelector(".MuiSheet-root");
      expect(container).toBeInTheDocument();
    });
  });
});
