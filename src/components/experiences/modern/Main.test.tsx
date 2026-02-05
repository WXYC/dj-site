import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import Main from "./Main";

// Mock MUI Joy
vi.mock("@mui/joy", () => ({
  Box: ({ children, component, className, sx, ...props }: any) => (
    <div
      data-testid="main-box"
      data-component={component}
      data-classname={className}
      {...props}
    >
      {children}
    </div>
  ),
}));

describe("Main", () => {
  it("should render children content", () => {
    render(
      <Main>
        <div data-testid="child">Child Content</div>
      </Main>
    );

    expect(screen.getByTestId("child")).toHaveTextContent("Child Content");
  });

  it("should render as main element", () => {
    render(<Main>Content</Main>);

    const mainBox = screen.getByTestId("main-box");
    expect(mainBox).toHaveAttribute("data-component", "main");
  });

  it("should have MainContent class", () => {
    render(<Main>Content</Main>);

    const mainBox = screen.getByTestId("main-box");
    expect(mainBox).toHaveAttribute("data-classname", "MainContent");
  });

  it("should render multiple children", () => {
    render(
      <Main>
        <div data-testid="child-1">First</div>
        <div data-testid="child-2">Second</div>
      </Main>
    );

    expect(screen.getByTestId("child-1")).toBeInTheDocument();
    expect(screen.getByTestId("child-2")).toBeInTheDocument();
  });
});
