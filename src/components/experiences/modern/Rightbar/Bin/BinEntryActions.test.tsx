import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import BinEntryActions from "./BinEntryActions";
import type { BinEntryAction } from "./useBinEntryActions";

vi.mock("@mui/joy", () => ({
  Stack: ({ children, className }: any) => (
    <div data-testid="actions-stack" className={className}>
      {children}
    </div>
  ),
  Tooltip: ({ children }: any) => <>{children}</>,
  IconButton: ({ children, onClick, "aria-label": ariaLabel, color }: any) => (
    <button aria-label={ariaLabel} data-color={color} onClick={onClick}>
      {children}
    </button>
  ),
}));

const Icon = () => <span>icon</span>;

describe("BinEntryActions", () => {
  const makeActions = (): BinEntryAction[] => [
    { id: "info", label: "More information", Icon, color: "neutral", run: vi.fn() },
    { id: "remove", label: "Remove from Bin", Icon, color: "warning", run: vi.fn() },
  ];

  it("renders one button per action with its aria-label and color", () => {
    render(<BinEntryActions actions={makeActions()} />);

    expect(screen.getByLabelText("More information")).toBeInTheDocument();
    const remove = screen.getByLabelText("Remove from Bin");
    expect(remove).toHaveAttribute("data-color", "warning");
  });

  it("passes the className through to the stack (hover reveal target)", () => {
    render(<BinEntryActions actions={makeActions()} className="bin-row-actions" />);

    expect(screen.getByTestId("actions-stack")).toHaveClass("bin-row-actions");
  });

  it("runs the action handler on click", () => {
    const actions = makeActions();
    render(<BinEntryActions actions={actions} />);

    fireEvent.click(screen.getByLabelText("More information"));
    expect(actions[0].run).toHaveBeenCalledTimes(1);
  });
});
