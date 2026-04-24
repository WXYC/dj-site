import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/lib/test-utils";
import RightbarPanelContainer from "./RightbarPanelContainer";

describe("RightbarPanelContainer", () => {
  const defaultProps = {
    title: "Test Panel",
    onClose: vi.fn(),
  };

  it("should render the title", () => {
    renderWithProviders(
      <RightbarPanelContainer {...defaultProps}>
        <div>content</div>
      </RightbarPanelContainer>
    );
    expect(screen.getByText("Test Panel")).toBeInTheDocument();
  });

  it("should render children", () => {
    renderWithProviders(
      <RightbarPanelContainer {...defaultProps}>
        <div>child content</div>
      </RightbarPanelContainer>
    );
    expect(screen.getByText("child content")).toBeInTheDocument();
  });

  it("should render a close button that calls onClose", async () => {
    const onClose = vi.fn();
    const { user } = renderWithProviders(
      <RightbarPanelContainer {...defaultProps} onClose={onClose}>
        <div>content</div>
      </RightbarPanelContainer>
    );
    await user.click(screen.getByRole("button", { name: /close/i }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("should render subtitle when provided", () => {
    renderWithProviders(
      <RightbarPanelContainer {...defaultProps} subtitle="DJ Stereolab">
        <div>content</div>
      </RightbarPanelContainer>
    );
    expect(screen.getByText("DJ Stereolab")).toBeInTheDocument();
  });

  it("should render startDecorator when provided", () => {
    renderWithProviders(
      <RightbarPanelContainer {...defaultProps} startDecorator={<span data-testid="icon">icon</span>}>
        <div>content</div>
      </RightbarPanelContainer>
    );
    expect(screen.getByTestId("icon")).toBeInTheDocument();
  });

  it("should render footer when provided", () => {
    renderWithProviders(
      <RightbarPanelContainer {...defaultProps} footer={<button>Save</button>}>
        <div>content</div>
      </RightbarPanelContainer>
    );
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
  });

  it("should not render footer when not provided", () => {
    renderWithProviders(
      <RightbarPanelContainer {...defaultProps}>
        <div>content</div>
      </RightbarPanelContainer>
    );
    expect(screen.queryByRole("button", { name: "Save" })).not.toBeInTheDocument();
  });
});
