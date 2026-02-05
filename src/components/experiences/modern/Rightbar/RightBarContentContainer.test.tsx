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

  describe("different label values", () => {
    it("should render with Mail Bin label", () => {
      render(
        <RightBarContentContainer
          label="Mail Bin"
          startDecorator={<span>Icon</span>}
        >
          <div>Content</div>
        </RightBarContentContainer>
      );

      expect(screen.getByText("Mail Bin")).toBeInTheDocument();
    });

    it("should render with Now Playing label", () => {
      render(
        <RightBarContentContainer
          label="Now Playing"
          startDecorator={<span>Icon</span>}
        >
          <div>Content</div>
        </RightBarContentContainer>
      );

      expect(screen.getByText("Now Playing")).toBeInTheDocument();
    });
  });

  describe("decorator configurations", () => {
    it("should render with SVG icon as start decorator", () => {
      render(
        <RightBarContentContainer
          label="Test"
          startDecorator={<svg data-testid="svg-icon" />}
        >
          <div>Content</div>
        </RightBarContentContainer>
      );

      expect(screen.getByTestId("svg-icon")).toBeInTheDocument();
    });

    it("should render with button as end decorator", () => {
      render(
        <RightBarContentContainer
          label="Test"
          startDecorator={<span>Start</span>}
          endDecorator={<button data-testid="action-button">Action</button>}
        >
          <div>Content</div>
        </RightBarContentContainer>
      );

      expect(screen.getByTestId("action-button")).toBeInTheDocument();
    });

    it("should render start decorator in Stack with label", () => {
      render(
        <RightBarContentContainer
          label="Test Label"
          startDecorator={<span data-testid="decorator">Icon</span>}
        >
          <div>Content</div>
        </RightBarContentContainer>
      );

      const decorator = screen.getByTestId("decorator");
      const label = screen.getByText("Test Label");

      // Both should be in the same parent Stack
      expect(decorator.parentElement).toBe(label.parentElement);
    });
  });

  describe("list structure", () => {
    it("should render List as container for children", () => {
      render(
        <RightBarContentContainer
          label="Test"
          startDecorator={<span>Start</span>}
        >
          <li data-testid="list-item">Item</li>
        </RightBarContentContainer>
      );

      expect(screen.getByRole("list")).toBeInTheDocument();
      expect(screen.getByTestId("list-item")).toBeInTheDocument();
    });
  });
});
