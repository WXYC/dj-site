import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import Main from "./Main";

describe("Main", () => {
  it("should render children", () => {
    render(
      <Main>
        <div data-testid="child-content">Test Content</div>
      </Main>
    );

    expect(screen.getByTestId("child-content")).toBeInTheDocument();
  });

  it("should render as main element", () => {
    render(
      <Main>
        <span>Content</span>
      </Main>
    );

    expect(screen.getByRole("main")).toBeInTheDocument();
  });

  it("should render multiple children", () => {
    render(
      <Main>
        <div data-testid="child-1">Child 1</div>
        <div data-testid="child-2">Child 2</div>
        <div data-testid="child-3">Child 3</div>
      </Main>
    );

    expect(screen.getByTestId("child-1")).toBeInTheDocument();
    expect(screen.getByTestId("child-2")).toBeInTheDocument();
    expect(screen.getByTestId("child-3")).toBeInTheDocument();
  });

  it("should render text children", () => {
    render(<Main>Simple text content</Main>);

    expect(screen.getByText("Simple text content")).toBeInTheDocument();
  });
});
