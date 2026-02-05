import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import SkeletonEntry from "./SkeletonEntry";

describe("SkeletonEntry", () => {
  it("should render a skeleton element", () => {
    const { container } = render(<SkeletonEntry />);
    expect(container.querySelector(".MuiSkeleton-root")).toBeInTheDocument();
  });

  it("should have rectangular variant", () => {
    const { container } = render(<SkeletonEntry />);
    const skeleton = container.querySelector(".MuiSkeleton-root");
    expect(skeleton).toBeInTheDocument();
  });

  it("should have rectangular variant", () => {
    const { container } = render(<SkeletonEntry />);
    const skeleton = container.querySelector(".MuiSkeleton-root");
    expect(skeleton).toHaveClass("MuiSkeleton-variantRectangular");
  });
});
