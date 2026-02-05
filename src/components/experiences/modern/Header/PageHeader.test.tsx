import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import PageHeader from "./PageHeader";

// Mock PageData component
vi.mock("@/src/Layout/PageData", () => ({
  default: ({ title }: { title: string }) => (
    <div data-testid="page-data" data-title={title}>
      PageData
    </div>
  ),
}));

describe("PageHeader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Title Rendering", () => {
    it("should render title as h2 heading", () => {
      render(<PageHeader title="Dashboard" />);

      const heading = screen.getByRole("heading", { level: 2 });
      expect(heading).toBeInTheDocument();
      expect(heading).toHaveTextContent("Dashboard");
    });

    it("should render different titles correctly", () => {
      const { rerender } = render(<PageHeader title="Catalog" />);
      expect(screen.getByRole("heading")).toHaveTextContent("Catalog");

      rerender(<PageHeader title="Flowsheet" />);
      expect(screen.getByRole("heading")).toHaveTextContent("Flowsheet");

      rerender(<PageHeader title="Admin" />);
      expect(screen.getByRole("heading")).toHaveTextContent("Admin");
    });

    it("should handle long titles", () => {
      render(<PageHeader title="This Is A Very Long Title For Testing" />);

      expect(screen.getByRole("heading")).toHaveTextContent(
        "This Is A Very Long Title For Testing"
      );
    });

    it("should handle empty title", () => {
      render(<PageHeader title="" />);

      const heading = screen.getByRole("heading");
      expect(heading).toBeInTheDocument();
      expect(heading).toHaveTextContent("");
    });

    it("should handle title with special characters", () => {
      render(<PageHeader title="Music & Artists - 2024" />);

      expect(screen.getByRole("heading")).toHaveTextContent(
        "Music & Artists - 2024"
      );
    });
  });

  describe("PageData Integration", () => {
    it("should render PageData component with title", () => {
      render(<PageHeader title="Dashboard" />);

      const pageData = screen.getByTestId("page-data");
      expect(pageData).toBeInTheDocument();
      expect(pageData).toHaveAttribute("data-title", "Dashboard");
    });

    it("should pass title prop to PageData", () => {
      render(<PageHeader title="My Custom Page" />);

      expect(screen.getByTestId("page-data")).toHaveAttribute(
        "data-title",
        "My Custom Page"
      );
    });
  });

  describe("Children Rendering", () => {
    it("should render children when provided", () => {
      render(
        <PageHeader title="Dashboard">
          <button data-testid="action-button">Action</button>
        </PageHeader>
      );

      expect(screen.getByTestId("action-button")).toBeInTheDocument();
    });

    it("should render multiple children", () => {
      render(
        <PageHeader title="Dashboard">
          <button data-testid="button-1">Button 1</button>
          <button data-testid="button-2">Button 2</button>
          <button data-testid="button-3">Button 3</button>
        </PageHeader>
      );

      expect(screen.getByTestId("button-1")).toBeInTheDocument();
      expect(screen.getByTestId("button-2")).toBeInTheDocument();
      expect(screen.getByTestId("button-3")).toBeInTheDocument();
    });

    it("should render without children", () => {
      render(<PageHeader title="Dashboard" />);

      expect(screen.getByRole("heading")).toBeInTheDocument();
    });

    it("should render text children", () => {
      render(<PageHeader title="Dashboard">Some text content</PageHeader>);

      expect(screen.getByText("Some text content")).toBeInTheDocument();
    });

    it("should render complex children", () => {
      render(
        <PageHeader title="Dashboard">
          <div data-testid="complex-child">
            <span>Nested content</span>
            <button>Click me</button>
          </div>
        </PageHeader>
      );

      expect(screen.getByTestId("complex-child")).toBeInTheDocument();
      expect(screen.getByText("Nested content")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Click me" })).toBeInTheDocument();
    });
  });

  describe("Layout Structure", () => {
    it("should render container Box", () => {
      render(<PageHeader title="Dashboard" />);

      const box = document.querySelector(".MuiBox-root");
      expect(box).toBeInTheDocument();
    });

    it("should render with flex display", () => {
      render(<PageHeader title="Dashboard" />);

      const box = document.querySelector(".MuiBox-root");
      expect(box).toHaveStyle({ display: "flex" });
    });

    it("should align items to center", () => {
      render(<PageHeader title="Dashboard" />);

      const box = document.querySelector(".MuiBox-root");
      expect(box).toHaveStyle({ alignItems: "center" });
    });

    it("should allow flex wrapping", () => {
      render(<PageHeader title="Dashboard" />);

      const box = document.querySelector(".MuiBox-root");
      expect(box).toHaveStyle({ flexWrap: "wrap" });
    });

    it("should have spacer box between title and children", () => {
      render(
        <PageHeader title="Dashboard">
          <button>Action</button>
        </PageHeader>
      );

      // There should be multiple Box elements including the spacer
      const boxes = document.querySelectorAll(".MuiBox-root");
      expect(boxes.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("Typography", () => {
    it("should render title with h2 level", () => {
      render(<PageHeader title="Dashboard" />);

      const typography = document.querySelector(".MuiTypography-root");
      expect(typography).toBeInTheDocument();
      expect(typography?.tagName.toLowerCase()).toBe("h2");
    });

    it("should have Typography component with proper MUI class", () => {
      render(<PageHeader title="Dashboard" />);

      const typography = document.querySelector(".MuiTypography-root");
      expect(typography).toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("should handle null children", () => {
      render(<PageHeader title="Dashboard">{null}</PageHeader>);

      expect(screen.getByRole("heading")).toBeInTheDocument();
    });

    it("should handle undefined children", () => {
      render(<PageHeader title="Dashboard">{undefined}</PageHeader>);

      expect(screen.getByRole("heading")).toBeInTheDocument();
    });

    it("should handle boolean children", () => {
      render(
        <PageHeader title="Dashboard">
          {true}
          {false}
        </PageHeader>
      );

      expect(screen.getByRole("heading")).toBeInTheDocument();
    });

    it("should handle conditional children", () => {
      const showButton = true;
      render(
        <PageHeader title="Dashboard">
          {showButton && <button data-testid="conditional">Conditional</button>}
        </PageHeader>
      );

      expect(screen.getByTestId("conditional")).toBeInTheDocument();
    });

    it("should not render conditional children when false", () => {
      const showButton = false;
      render(
        <PageHeader title="Dashboard">
          {showButton && <button data-testid="conditional">Conditional</button>}
        </PageHeader>
      );

      expect(screen.queryByTestId("conditional")).not.toBeInTheDocument();
    });
  });

  describe("Accessibility", () => {
    it("should have accessible heading structure", () => {
      render(<PageHeader title="Dashboard" />);

      const heading = screen.getByRole("heading", { level: 2 });
      expect(heading).toBeInTheDocument();
    });

    it("should maintain accessible structure with children", () => {
      render(
        <PageHeader title="Dashboard">
          <button>Action</button>
        </PageHeader>
      );

      expect(screen.getByRole("heading", { level: 2 })).toBeInTheDocument();
      expect(screen.getByRole("button")).toBeInTheDocument();
    });
  });

  describe("Fragment Wrapper", () => {
    it("should render PageData and Box inside a fragment", () => {
      const { container } = render(<PageHeader title="Dashboard" />);

      // Should have both PageData and Box as children
      expect(screen.getByTestId("page-data")).toBeInTheDocument();
      expect(document.querySelector(".MuiBox-root")).toBeInTheDocument();
    });
  });

  describe("Common Page Titles", () => {
    const commonTitles = [
      "Catalog",
      "Flowsheet",
      "Dashboard",
      "Admin",
      "Roster",
      "Settings",
      "Profile",
    ];

    commonTitles.forEach((title) => {
      it(`should render correctly with title: ${title}`, () => {
        render(<PageHeader title={title} />);

        expect(screen.getByRole("heading")).toHaveTextContent(title);
        expect(screen.getByTestId("page-data")).toHaveAttribute(
          "data-title",
          title
        );
      });
    });
  });
});
