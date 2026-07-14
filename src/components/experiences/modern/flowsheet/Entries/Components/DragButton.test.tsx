import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { DragControls } from "motion/react";
import DragButton from "./DragButton";

describe("DragButton", () => {
  it("should render the drag grip", () => {
    const mockControls = { start: vi.fn() } as unknown as DragControls;

    render(<DragButton controls={mockControls} />);

    expect(screen.getByRole("button")).toBeInTheDocument();
    expect(screen.getByTestId("DragIndicatorIcon")).toBeInTheDocument();
  });

  it("should start the drag on pointer down", () => {
    const start = vi.fn();
    const mockControls = { start } as unknown as DragControls;

    render(<DragButton controls={mockControls} />);

    fireEvent.pointerDown(screen.getByRole("button"));
    expect(start).toHaveBeenCalledTimes(1);
  });

  it("should not start the drag on render", () => {
    const start = vi.fn();
    const mockControls = { start } as unknown as DragControls;

    render(<DragButton controls={mockControls} />);

    expect(start).not.toHaveBeenCalled();
  });
});
