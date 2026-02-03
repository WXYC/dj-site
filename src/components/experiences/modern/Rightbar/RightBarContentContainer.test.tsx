import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import RightBarContentContainer from "./RightBarContentContainer";

describe("RightBarContentContainer", () => {
  it("should render label", () => {
    render(
      <RightBarContentContainer
        label="Test Label"
        startDecorator={<span>Start</span>}
      >
        <div>Content</div>
      </RightBarContentContainer>
    );

    expect(screen.getByText("Test Label")).toBeInTheDocument();
  });

  it("should render start decorator", () => {
    render(
      <RightBarContentContainer
        label="Test Label"
        startDecorator={<span data-testid="start-decorator">Start Icon</span>}
      >
        <div>Content</div>
      </RightBarContentContainer>
    );

    expect(screen.getByTestId("start-decorator")).toBeInTheDocument();
  });

  it("should render end decorator when provided", () => {
    render(
      <RightBarContentContainer
        label="Test Label"
        startDecorator={<span>Start</span>}
        endDecorator={<span data-testid="end-decorator">End Icon</span>}
      >
        <div>Content</div>
      </RightBarContentContainer>
    );

    expect(screen.getByTestId("end-decorator")).toBeInTheDocument();
  });

  it("should render children", () => {
    render(
      <RightBarContentContainer
        label="Test Label"
        startDecorator={<span>Start</span>}
      >
        <div data-testid="child-content">Child Content</div>
      </RightBarContentContainer>
    );

    expect(screen.getByTestId("child-content")).toBeInTheDocument();
  });

  it("should not render end decorator when not provided", () => {
    render(
      <RightBarContentContainer
        label="Test Label"
        startDecorator={<span>Start</span>}
      >
        <div>Content</div>
      </RightBarContentContainer>
    );

    expect(screen.queryByTestId("end-decorator")).not.toBeInTheDocument();
  });

  it("should render list subheader with presentation role", () => {
    render(
      <RightBarContentContainer
        label="Test Label"
        startDecorator={<span>Start</span>}
      >
        <div>Content</div>
      </RightBarContentContainer>
    );

    expect(screen.getByRole("presentation")).toBeInTheDocument();
  });

  it("should render multiple children", () => {
    render(
      <RightBarContentContainer
        label="Test Label"
        startDecorator={<span>Start</span>}
      >
        <div data-testid="child-1">Child 1</div>
        <div data-testid="child-2">Child 2</div>
        <div data-testid="child-3">Child 3</div>
      </RightBarContentContainer>
    );

    expect(screen.getByTestId("child-1")).toBeInTheDocument();
    expect(screen.getByTestId("child-2")).toBeInTheDocument();
    expect(screen.getByTestId("child-3")).toBeInTheDocument();
  });
});
