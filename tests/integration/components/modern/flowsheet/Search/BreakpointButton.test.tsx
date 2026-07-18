import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import BreakpointButton from "@/src/components/experiences/modern/flowsheet/Search/BreakpointButton";

const mockAddToFlowsheet = vi.fn();

vi.mock("@/lib/features/flowsheet/api", () => ({
  useAddToFlowsheetMutation: () => [mockAddToFlowsheet, {}],
}));

let mockLive = true;
let mockBreakpointMessages: string[] = [];

vi.mock("@/src/hooks/flowsheetHooks", () => ({
  useFlowsheetSearch: () => ({
    live: mockLive,
  }),
  useCurrentBreakpointMessages: () => mockBreakpointMessages,
}));

describe("BreakpointButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLive = true;
    mockBreakpointMessages = [];
  });

  it("should be disabled while live status is unresolved or off air", () => {
    mockLive = false;
    render(<BreakpointButton />);
    expect(screen.getByRole("button")).toBeDisabled();
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
        entry_type: "breakpoint",
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
