import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import PageContainer from "./PageContainer";

describe("PageContainer", () => {
  it("should render children", () => {
    render(<PageContainer><span data-testid="child">Content</span></PageContainer>);
    expect(screen.getByTestId("child")).toBeInTheDocument();
  });

  it("should apply className", () => {
    render(<PageContainer className="test-class">Content</PageContainer>);
    expect(document.querySelector(".test-class")).toBeInTheDocument();
  });

  it("should have default maxWidth of 1400px", () => {
    const { container } = render(<PageContainer>Content</PageContainer>);
    const box = container.firstChild as HTMLElement;
    expect(box).toHaveStyle({ maxWidth: "1400px" });
  });

  it("should apply custom maxWidth", () => {
    const { container } = render(<PageContainer maxWidth="800px">Content</PageContainer>);
    const box = container.firstChild as HTMLElement;
    expect(box).toHaveStyle({ maxWidth: "800px" });
  });

  it("should have 100% width", () => {
    const { container } = render(<PageContainer>Content</PageContainer>);
    const box = container.firstChild as HTMLElement;
    expect(box).toHaveStyle({ width: "100%" });
  });

  it("should center content with margin auto", () => {
    const { container } = render(<PageContainer>Content</PageContainer>);
    const box = container.firstChild as HTMLElement;
    expect(box).toHaveStyle({ margin: "0px auto" });
  });
});
