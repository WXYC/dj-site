import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import TalksetButton from "./TalksetButton";

const mockAddToFlowsheet = vi.fn();

vi.mock("@/lib/features/flowsheet/api", () => ({
  useAddToFlowsheetMutation: () => [mockAddToFlowsheet, {}],
}));

vi.mock("@/src/hooks/flowsheetHooks", () => ({
  useFlowsheetSearch: () => ({
    live: true,
  }),
}));

describe("TalksetButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render an icon button", () => {
    render(<TalksetButton />);
    expect(screen.getByRole("button")).toBeInTheDocument();
  });

  it("should have danger color", () => {
    render(<TalksetButton />);
    const button = screen.getByRole("button");
    expect(button).toHaveClass("MuiIconButton-colorDanger");
  });

  it("should call addToFlowsheet with Talkset message when clicked", () => {
    render(<TalksetButton />);
    const button = screen.getByRole("button");
    fireEvent.click(button);
    expect(mockAddToFlowsheet).toHaveBeenCalledWith({
      message: "Talkset",
    });
  });

  it("should render Mic icon", () => {
    const { container } = render(<TalksetButton />);
    expect(container.querySelector("svg")).toBeInTheDocument();
  });
});

describe("TalksetButton solid variant", () => {
  it("should have solid variant", () => {
    render(<TalksetButton />);
    const button = screen.getByRole("button");
    expect(button).toHaveClass("MuiIconButton-variantSolid");
  });
});
