import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import BreakpointButton from "./BreakpointButton";

const mockAddToFlowsheet = vi.fn();

vi.mock("@/lib/features/flowsheet/api", () => ({
  useAddToFlowsheetMutation: () => [mockAddToFlowsheet, {}],
}));

vi.mock("@/src/hooks/flowsheetHooks", () => ({
  useFlowsheetSearch: () => ({
    live: true,
  }),
}));

vi.mock("@/src/utilities/closesthour", () => ({
  getClosestHour: () => new Date("2024-01-15T14:00:00"),
}));

describe("BreakpointButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render an icon button", () => {
    render(<BreakpointButton />);
    expect(screen.getByRole("button")).toBeInTheDocument();
  });

  it("should have warning color", () => {
    render(<BreakpointButton />);
    const button = screen.getByRole("button");
    expect(button).toHaveClass("MuiIconButton-colorWarning");
  });

  it("should call addToFlowsheet with breakpoint message when clicked", () => {
    render(<BreakpointButton />);
    const button = screen.getByRole("button");
    fireEvent.click(button);
    expect(mockAddToFlowsheet).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining("Breakpoint"),
      })
    );
  });

  it("should render Timer icon", () => {
    const { container } = render(<BreakpointButton />);
    expect(container.querySelector("svg")).toBeInTheDocument();
  });
});

describe("BreakpointButton solid variant", () => {
  it("should have solid variant", () => {
    render(<BreakpointButton />);
    const button = screen.getByRole("button");
    expect(button).toHaveClass("MuiIconButton-variantSolid");
  });
});
