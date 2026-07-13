import { describe, it, expect, vi } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { renderWithProviders } from "@/lib/test-utils";
import BinEntryActions from "./BinEntryActions";
import type { BinEntryAction } from "./useBinEntryActions";

const Icon = () => <span>icon</span>;

describe("BinEntryActions", () => {
  const makeActions = (): BinEntryAction[] => [
    { id: "info", label: "More information", Icon, color: "neutral", run: vi.fn() },
    { id: "remove", label: "Remove from Bin", Icon, color: "warning", run: vi.fn() },
  ];

  it("renders one button per action with its aria-label", () => {
    renderWithProviders(<BinEntryActions actions={makeActions()} />);

    expect(screen.getByLabelText("More information")).toBeInTheDocument();
    expect(screen.getByLabelText("Remove from Bin")).toBeInTheDocument();
  });

  it("passes the className through to the stack (hover reveal target)", () => {
    const { container } = renderWithProviders(
      <BinEntryActions actions={makeActions()} className="bin-row-actions" />
    );

    expect(container.querySelector(".bin-row-actions")).not.toBeNull();
  });

  it("runs the action handler on click", () => {
    const actions = makeActions();
    renderWithProviders(<BinEntryActions actions={actions} />);

    fireEvent.click(screen.getByLabelText("More information"));
    expect(actions[0].run).toHaveBeenCalledTimes(1);
    expect(actions[0].run).toHaveBeenCalledWith({ shiftKey: false });
  });

  it("forwards the click's Shift state so Shift-removable actions can chain", () => {
    const run = vi.fn();
    renderWithProviders(
      <BinEntryActions
        actions={[
          {
            id: "queue",
            label: "Add to Queue",
            Icon,
            color: "success",
            run,
            shiftRemoves: true,
          },
        ]}
      />
    );

    fireEvent.click(screen.getByLabelText("Add to Queue"), { shiftKey: true });
    expect(run).toHaveBeenCalledWith({ shiftKey: true });
  });
});
