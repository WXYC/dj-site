import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import DragButton from "./DragButton";

describe("DragButton", () => {
  it("should render null when dragging is disabled", () => {
    const mockControls = {} as any;

    const { container } = render(<DragButton controls={mockControls} />);

    // DragButton returns null, so the container should be empty
    expect(container).toBeEmptyDOMElement();
  });
});
