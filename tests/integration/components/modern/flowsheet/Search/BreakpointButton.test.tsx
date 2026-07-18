import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import BreakpointButton from "@/src/components/experiences/modern/flowsheet/Search/BreakpointButton";
import { stationBreakpointMessage } from "@/src/utilities/stationTime";

// Bare RTL render (not renderWithProviders) because the component's hooks are
// fully mocked here, so no store/theme providers are exercised.

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

describe("BreakpointButton one-per-station-hour guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLive = true;
    vi.useFakeTimers();
    // 23:30 Eastern — the current station hour's breakpoint already exists.
    vi.setSystemTime(new Date("2026-07-17T03:30:00Z"));
    mockBreakpointMessages = [stationBreakpointMessage()];
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("stays enabled when the current station hour is already marked", () => {
    // Deliberately not disabled: a disabled button computed from render-time
    // now would outlive its station hour and lock out the next one.
    render(<BreakpointButton />);
    expect(screen.getByRole("button")).not.toBeDisabled();
  });

  it("does not dispatch a duplicate when clicked for an already-marked hour", () => {
    render(<BreakpointButton />);
    fireEvent.click(screen.getByRole("button"));
    expect(mockAddToFlowsheet).not.toHaveBeenCalled();
  });

  it("dispatches once the marked breakpoint belongs to a different station hour", () => {
    mockBreakpointMessages = ["10:00 PM Breakpoint"];
    render(<BreakpointButton />);
    fireEvent.click(screen.getByRole("button"));
    expect(mockAddToFlowsheet).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "11:00 PM Breakpoint",
        entry_type: "breakpoint",
      })
    );
  });
});

describe("BreakpointButton solid variant", () => {
  it("should have solid variant", () => {
    render(<BreakpointButton />);
    const button = screen.getByRole("button");
    expect(button).toHaveClass("MuiIconButton-variantSolid");
  });
});
