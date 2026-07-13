import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import BinEntryContextMenu from "./BinEntryContextMenu";
import type { BinEntryAction } from "./useBinEntryActions";

vi.mock("@mui/joy", () => ({
  MenuList: ({ children }: any) => <ul data-testid="menu-list">{children}</ul>,
  MenuItem: ({ children, onClick }: any) => (
    <li role="menuitem" onClick={onClick}>
      {children}
    </li>
  ),
  ListItemDecorator: ({ children }: any) => <>{children}</>,
}));
vi.mock("@mui/material/Popper", () => ({
  default: ({ children, open }: any) => (open ? <div>{children}</div> : null),
}));
vi.mock("@mui/material/ClickAwayListener", () => ({
  default: ({ children }: any) => <>{children}</>,
}));

const Icon = () => <span>icon</span>;

describe("BinEntryContextMenu", () => {
  const actions: BinEntryAction[] = [
    { id: "info", label: "More information", Icon, color: "neutral", run: vi.fn() },
    { id: "remove", label: "Remove from Bin", Icon, color: "warning", run: vi.fn() },
  ];

  it("renders nothing when there is no anchor", () => {
    render(
      <BinEntryContextMenu actions={actions} anchor={null} onClose={vi.fn()} />
    );

    expect(screen.queryByTestId("menu-list")).not.toBeInTheDocument();
  });

  it("renders a menu item per action when anchored", () => {
    render(
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
    render(
      <BinEntryContextMenu
        actions={[{ id: "info", label: "More information", Icon, color: "neutral", run }]}
        anchor={{ top: 0, left: 0 }}
        onClose={onClose}
      />
    );

    fireEvent.click(screen.getByText("More information"));
    expect(run).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
