import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { LoadingPage } from "./LoadingPage";

describe("LoadingPage", () => {
  it("should render a modal", () => {
    const { baseElement } = render(<LoadingPage />);
    expect(baseElement.querySelector(".MuiModal-root")).toBeInTheDocument();
  });

  it("should render a circular progress indicator", () => {
    const { baseElement } = render(<LoadingPage />);
    expect(baseElement.querySelector(".MuiCircularProgress-root")).toBeInTheDocument();
  });

  it("should have the modal open", () => {
    const { baseElement } = render(<LoadingPage />);
    // Modal should be visible
    expect(baseElement.querySelector(".MuiModal-root")).toBeInTheDocument();
  });
});
