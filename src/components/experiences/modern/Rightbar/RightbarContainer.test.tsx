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
});
