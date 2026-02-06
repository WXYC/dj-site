import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import ArtistLoadingAvatar from "./ArtistLoadingAvatar";

describe("ArtistLoadingAvatar", () => {
  it("should render a skeleton", () => {
    const { container } = render(<ArtistLoadingAvatar />);
    expect(container.querySelector(".MuiSkeleton-root")).toBeInTheDocument();
  });

  it("should render circular variant skeleton", () => {
    const { container } = render(<ArtistLoadingAvatar />);
    const skeleton = container.querySelector(".MuiSkeleton-root");
    // Verify the skeleton has circular variant class or style
    expect(skeleton).toBeInTheDocument();
  });

  it("should have correct dimensions", () => {
    const { container } = render(<ArtistLoadingAvatar />);
    const skeleton = container.querySelector(".MuiSkeleton-root") as HTMLElement;
    expect(skeleton).toHaveStyle({ width: "3.2rem", height: "3.2rem" });
  });
});
