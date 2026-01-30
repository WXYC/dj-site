import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import FlowsheetSkeletonLoader from "./FlowsheetSkeletonLoader";

describe("FlowsheetSkeletonLoader", () => {
  it("should render specified number of skeleton entries", () => {
    const { container } = render(<FlowsheetSkeletonLoader count={5} />);
    const skeletons = container.querySelectorAll(".MuiSkeleton-root");
    expect(skeletons).toHaveLength(5);
  });

  it("should render no skeletons when count is 0", () => {
    const { container } = render(<FlowsheetSkeletonLoader count={0} />);
    const skeletons = container.querySelectorAll(".MuiSkeleton-root");
    expect(skeletons).toHaveLength(0);
  });

  it("should render as a stack", () => {
    const { container } = render(<FlowsheetSkeletonLoader count={3} />);
    expect(container.querySelector(".MuiStack-root")).toBeInTheDocument();
  });

  it("should render one skeleton when count is 1", () => {
    const { container } = render(<FlowsheetSkeletonLoader count={1} />);
    const skeletons = container.querySelectorAll(".MuiSkeleton-root");
    expect(skeletons).toHaveLength(1);
  });
});
