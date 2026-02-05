import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import Main from "./Main";

describe("Main", () => {
  it("should render main element", () => {
    render(<Main>Test Content</Main>);
    expect(document.querySelector("main")).toBeInTheDocument();
  });

  it("should render children", () => {
    render(<Main><span data-testid="child">Child Content</span></Main>);
    expect(screen.getByTestId("child")).toBeInTheDocument();
    expect(screen.getByText("Child Content")).toBeInTheDocument();
  });

  it("should render multiple children", () => {
    render(
      <Main>
        <div data-testid="first">First</div>
        <div data-testid="second">Second</div>
      </Main>
    );
    expect(screen.getByTestId("first")).toBeInTheDocument();
    expect(screen.getByTestId("second")).toBeInTheDocument();
  });
});
