"use client";

import { useShiftKey } from "@/src/hooks/applicationHooks";
import { Chip, ListItemDecorator, MenuItem, MenuList, Typography } from "@mui/joy";
import ClickAwayListener from "@mui/material/ClickAwayListener";
import Popper from "@mui/material/Popper";
import { useEffect } from "react";
import type { BinEntryAction } from "./useBinEntryActions";

export type BinContextMenuAnchor = { top: number; left: number };

/**
 * Right-click context menu for a Mail Bin entry, opened at the mouse position.
 * Renders the same action set as the hover buttons; queue/play items carry the
 * "+ Shift to remove from bin" hint (highlighted while Shift is held), and
 * Escape closes the menu like the Joy Dropdown it replaced.
 *
 * The key/shift listeners live in the inner component so they only exist
 * while a menu is actually open — every bin row mounts this wrapper.
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
  return <OpenContextMenu actions={actions} anchor={anchor} onClose={onClose} />;
}

function OpenContextMenu({
  actions,
  anchor,
  onClose,
}: {
  actions: BinEntryAction[];
  anchor: BinContextMenuAnchor;
  onClose: () => void;
}) {
  const shiftKeyPressed = useShiftKey();

  // Raw Popper+MenuList has no built-in Escape handling (Joy's Dropdown did
  // it for free); wire it up while the menu is open.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

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
          {actions.map(({ id, label, Icon, color, run, shiftRemoves }) => (
            <MenuItem
              key={id}
              color={color}
              onClick={(e) => {
                run({ shiftKey: e.shiftKey });
                onClose();
              }}
            >
              <ListItemDecorator>
                <Icon fontSize="small" />
              </ListItemDecorator>
              {label}
              {shiftRemoves && (
                <>
                  <Chip
                    size="sm"
                    variant="outlined"
                    sx={{
                      ml: "auto",
                      color: shiftKeyPressed ? "CaptionText" : "neutral.400",
                    }}
                  >
                    + Shift
                  </Chip>
                  <Typography
                    level="body-xs"
                    sx={{
                      color: shiftKeyPressed ? "CaptionText" : "neutral.400",
                    }}
                  >
                    to remove from bin
                  </Typography>
                </>
              )}
            </MenuItem>
          ))}
        </MenuList>
      </ClickAwayListener>
    </Popper>
  );
}
