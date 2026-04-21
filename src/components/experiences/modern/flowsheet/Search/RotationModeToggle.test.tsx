import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import RotationModeToggle from "./RotationModeToggle";

const mockDispatch = vi.fn();
let mockRotationMode = false;
let mockLive = true;

vi.mock("@/lib/hooks", () => ({
  useAppDispatch: () => mockDispatch,
  useAppSelector: (selector: any) => selector({
    flowsheet: { rotationMode: mockRotationMode },
  }),
}));

vi.mock("@/src/hooks/flowsheetHooks", () => ({
  useFlowsheetSearch: () => ({
    live: mockLive,
  }),
}));

vi.mock("@/lib/features/flowsheet/frontend", () => ({
  flowsheetSlice: {
    actions: {
      setRotationMode: (value: boolean) => ({ type: "flowsheet/setRotationMode", payload: value }),
    },
    selectors: {
      getRotationMode: (state: any) => state.flowsheet.rotationMode,
    },
  },
}));

describe("RotationModeToggle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRotationMode = false;
    mockLive = true;
  });

  it("should render an icon button", () => {
    render(<RotationModeToggle />);
    expect(screen.getByRole("button")).toBeInTheDocument();
  });

  it("should dispatch setRotationMode(true) when clicked while inactive", () => {
    render(<RotationModeToggle />);
    fireEvent.click(screen.getByRole("button"));
    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: "flowsheet/setRotationMode", payload: true })
    );
  });

  it("should dispatch setRotationMode(false) when clicked while active", () => {
    mockRotationMode = true;
    render(<RotationModeToggle />);
    fireEvent.click(screen.getByRole("button"));
    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: "flowsheet/setRotationMode", payload: false })
    );
  });

  it("should be disabled when not live", () => {
    mockLive = false;
    render(<RotationModeToggle />);
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("should have solid variant when rotation mode is active", () => {
    mockRotationMode = true;
    render(<RotationModeToggle />);
    expect(screen.getByRole("button")).toHaveClass("MuiIconButton-variantSolid");
  });

  it("should have outlined variant when rotation mode is inactive", () => {
    render(<RotationModeToggle />);
    expect(screen.getByRole("button")).toHaveClass("MuiIconButton-variantOutlined");
  });

  it("should render an SVG icon", () => {
    const { container } = render(<RotationModeToggle />);
    expect(container.querySelector("svg")).toBeInTheDocument();
  });
});
