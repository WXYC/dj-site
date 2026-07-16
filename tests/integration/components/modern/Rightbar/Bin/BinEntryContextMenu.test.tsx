import { describe, it, expect, vi } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { renderWithProviders } from "@/tests/helpers";
import BinEntryContextMenu from "@/src/components/experiences/modern/Rightbar/Bin/BinEntryContextMenu";
import type { BinEntryAction } from "@/src/components/experiences/modern/Rightbar/Bin/useBinEntryActions";

const Icon = ({ fontSize }: { fontSize?: string }) => <span>icon</span>;

describe("BinEntryContextMenu", () => {
  const actions: BinEntryAction[] = [
    { id: "info", label: "More information", Icon, color: "neutral", run: vi.fn() },
    { id: "remove", label: "Remove from Bin", Icon, color: "warning", run: vi.fn() },
  ];

  it("renders nothing when there is no anchor", () => {
    renderWithProviders(
      <BinEntryContextMenu actions={actions} anchor={null} onClose={vi.fn()} />
    );

    expect(screen.queryByRole("menuitem")).not.toBeInTheDocument();
  });

  it("renders a menu item per action when anchored", () => {
    renderWithProviders(
      <BinEntryContextMenu
        actions={actions}
        anchor={{ top: 20, left: 10 }}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText("More information")).toBeInTheDocument();
    expect(screen.getByText("Remove from Bin")).toBeInTheDocument();
  });

  it("runs the action and closes the menu on click", () => {
    const onClose = vi.fn();
    const run = vi.fn();
    renderWithProviders(
      <BinEntryContextMenu
        actions={[{ id: "info", label: "More information", Icon, color: "neutral", run }]}
        anchor={{ top: 0, left: 0 }}
        onClose={onClose}
      />
    );

    fireEvent.click(screen.getByText("More information"));
    expect(run).toHaveBeenCalledTimes(1);
    expect(run).toHaveBeenCalledWith({ shiftKey: false });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes on Escape like the Joy Dropdown it replaced", () => {
    const onClose = vi.fn();
    renderWithProviders(
      <BinEntryContextMenu
        actions={actions}
        anchor={{ top: 0, left: 0 }}
        onClose={onClose}
      />
    );

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("shows the Shift hint only on Shift-removable actions", () => {
    renderWithProviders(
      <BinEntryContextMenu
        actions={[
          {
            id: "queue",
            label: "Add to Queue",
            Icon,
            color: "success",
            run: vi.fn(),
            shiftRemoves: true,
          },
          {
            id: "remove",
            label: "Remove from Bin",
            Icon,
            color: "warning",
            run: vi.fn(),
          },
        ]}
        anchor={{ top: 0, left: 0 }}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText("+ Shift")).toBeInTheDocument();
    expect(screen.getByText("to remove from bin")).toBeInTheDocument();
  });

  it("passes the click's Shift state through to the action", () => {
    const run = vi.fn();
    renderWithProviders(
      <BinEntryContextMenu
        actions={[
          {
            id: "play",
            label: "Play Now",
            Icon,
            color: "primary",
            run,
            shiftRemoves: true,
          },
        ]}
        anchor={{ top: 0, left: 0 }}
        onClose={vi.fn()}
      />
    );

    fireEvent.click(screen.getByText("Play Now"), { shiftKey: true });
    expect(run).toHaveBeenCalledWith({ shiftKey: true });
  });
});
