import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import RightbarContainer from "./RightbarContainer";

describe("RightbarContainer", () => {
  it("should render children", () => {
    render(
      <RightbarContainer>
        <div data-testid="child-content">Child Content</div>
      </RightbarContainer>
    );

    expect(screen.getByTestId("child-content")).toBeInTheDocument();
  });

  it("should render multiple children", () => {
    render(
      <RightbarContainer>
        <div data-testid="child-1">Child 1</div>
        <div data-testid="child-2">Child 2</div>
        <div data-testid="child-3">Child 3</div>
      </RightbarContainer>
    );

    expect(screen.getByTestId("child-1")).toBeInTheDocument();
    expect(screen.getByTestId("child-2")).toBeInTheDocument();
    expect(screen.getByTestId("child-3")).toBeInTheDocument();
  });

  it("should have SecondSidebar class", () => {
    render(
      <RightbarContainer>
        <div>Content</div>
      </RightbarContainer>
    );

    const container = screen.getByText("Content").parentElement;
    expect(container).toHaveClass("SecondSidebar");
  });

  it("should render as Sheet component", () => {
    render(
      <RightbarContainer>
        <div data-testid="content">Content</div>
      </RightbarContainer>
    );

    // Sheet renders as a div with MuiSheet class
    const container = screen.getByTestId("content").parentElement;
    expect(container).toHaveClass("MuiSheet-root");
  });

  describe("container structure", () => {
    it("should render children in correct order", () => {
      render(
        <RightbarContainer>
          <div data-testid="first">First</div>
          <div data-testid="second">Second</div>
          <div data-testid="third">Third</div>
        </RightbarContainer>
      );

      const first = screen.getByTestId("first");
      const second = screen.getByTestId("second");
      const third = screen.getByTestId("third");

      // Verify order in DOM
      expect(
        first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING
      ).toBeTruthy();
      expect(
        second.compareDocumentPosition(third) &
          Node.DOCUMENT_POSITION_FOLLOWING
      ).toBeTruthy();
    });

    it("should render single child", () => {
      render(
        <RightbarContainer>
          <div data-testid="only-child">Only Child</div>
        </RightbarContainer>
      );

      expect(screen.getByTestId("only-child")).toBeInTheDocument();
    });

    it("should render nested elements", () => {
      render(
        <RightbarContainer>
          <div data-testid="parent">
            <div data-testid="nested-child">Nested Content</div>
          </div>
        </RightbarContainer>
      );

      expect(screen.getByTestId("parent")).toBeInTheDocument();
      expect(screen.getByTestId("nested-child")).toBeInTheDocument();
    });

    it("should preserve child element types", () => {
      render(
        <RightbarContainer>
          <section data-testid="section-element">Section</section>
          <article data-testid="article-element">Article</article>
        </RightbarContainer>
      );

      expect(screen.getByTestId("section-element").tagName).toBe("SECTION");
      expect(screen.getByTestId("article-element").tagName).toBe("ARTICLE");
    });
  });

  describe("styling", () => {
    it("should render Sheet container", () => {
      render(
        <RightbarContainer>
          <div data-testid="content">Content</div>
        </RightbarContainer>
      );

      const container = screen.getByTestId("content").parentElement;
      expect(container).toHaveClass("MuiSheet-root");
    });

    it("should have SecondSidebar className on Sheet", () => {
      render(
        <RightbarContainer>
          <div data-testid="content">Content</div>
        </RightbarContainer>
      );

      const container = document.querySelector(".SecondSidebar");
      expect(container).toBeInTheDocument();
      expect(container).toHaveClass("MuiSheet-root");
    });
  });
});
