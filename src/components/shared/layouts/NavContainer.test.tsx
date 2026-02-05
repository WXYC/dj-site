import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import NavContainer from "./NavContainer";

describe("NavContainer", () => {
  it("should render nav element", () => {
    render(<NavContainer>Content</NavContainer>);
    expect(document.querySelector("nav")).toBeInTheDocument();
  });

  it("should render children", () => {
    render(<NavContainer><span data-testid="child">Child</span></NavContainer>);
    expect(screen.getByTestId("child")).toBeInTheDocument();
  });

  it("should apply className", () => {
    render(<NavContainer className="test-class">Content</NavContainer>);
    expect(document.querySelector("nav")).toHaveClass("test-class");
  });

  it("should default to horizontal orientation", () => {
    render(<NavContainer>Content</NavContainer>);
    const nav = document.querySelector("nav");
    expect(nav).toHaveStyle({ flexDirection: "row" });
  });

  it("should apply vertical orientation when specified", () => {
    render(<NavContainer orientation="vertical">Content</NavContainer>);
    const nav = document.querySelector("nav");
    expect(nav).toHaveStyle({ flexDirection: "column" });
  });

  it("should default to relative position", () => {
    render(<NavContainer>Content</NavContainer>);
    const nav = document.querySelector("nav");
    expect(nav).toHaveStyle({ position: "relative" });
  });

  it("should apply fixed position when specified", () => {
    render(<NavContainer position="fixed">Content</NavContainer>);
    const nav = document.querySelector("nav");
    expect(nav).toHaveStyle({ position: "fixed" });
  });

  it("should apply sticky position when specified", () => {
    render(<NavContainer position="sticky">Content</NavContainer>);
    const nav = document.querySelector("nav");
    expect(nav).toHaveStyle({ position: "sticky" });
  });
});
