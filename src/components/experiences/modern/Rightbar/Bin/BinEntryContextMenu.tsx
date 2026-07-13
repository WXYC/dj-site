"use client";

import { ListItemDecorator, MenuItem, MenuList } from "@mui/joy";
import ClickAwayListener from "@mui/material/ClickAwayListener";
import Popper from "@mui/material/Popper";
import type { BinEntryAction } from "./useBinEntryActions";

export type BinContextMenuAnchor = { top: number; left: number };

/**
 * Right-click context menu for a Mail Bin entry, opened at the mouse position.
 * Renders the same action set as the hover buttons — no shortcut-hint pills.
 */
export default function BinEntryContextMenu({
  actions,
  anchor,
  onClose,
}: {
  actions: BinEntryAction[];
  anchor: BinContextMenuAnchor | null;
  onClose: () => void;
}) {
  if (anchor === null) return null;

  // Virtual element positions the Popper at the exact cursor coordinates.
  const virtualAnchor = {
    getBoundingClientRect: () => ({
      width: 0,
      height: 0,
      top: anchor.top,
      right: anchor.left,
      bottom: anchor.top,
      left: anchor.left,
      x: anchor.left,
      y: anchor.top,
      toJSON: () => ({}),
    }),
  };

  return (
    <Popper
      open
      anchorEl={virtualAnchor}
      placement="bottom-start"
      style={{ zIndex: 10000 }}
    >
      <ClickAwayListener onClickAway={onClose}>
        <MenuList
          variant="outlined"
          size="sm"
          sx={{ boxShadow: "md", minWidth: 200, bgcolor: "background.popup" }}
        >
          {actions.map(({ id, label, Icon, color, run }) => (
            <MenuItem
              key={id}
              color={color}
              onClick={() => {
                run();
                onClose();
              }}
            >
              <ListItemDecorator>
                <Icon fontSize="small" />
              </ListItemDecorator>
              {label}
            </MenuItem>
          ))}
        </MenuList>
      </ClickAwayListener>
    </Popper>
  );
}
