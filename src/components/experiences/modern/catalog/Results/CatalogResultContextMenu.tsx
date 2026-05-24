"use client";

import {
  Archive,
  EditOutlined,
  InfoOutlined,
  Unarchive,
} from "@mui/icons-material";
import { ClickAwayListener } from "@mui/material";
import Popper from "@mui/material/Popper";
import { MenuItem, MenuList } from "@mui/joy";
import type { VirtualElement } from "@popperjs/core";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import type { CatalogResultActions } from "./useCatalogResultActions";

export type ContextMenuAnchor = { top: number; left: number };

type CatalogResultContextMenuProps = {
  actions: CatalogResultActions;
};

function contextMenuVirtualAnchor(top: number, left: number): VirtualElement {
  return {
    getBoundingClientRect: () =>
      DOMRect.fromRect({
        x: left,
        y: top,
        width: 0,
        height: 0,
        top,
        left,
        right: left,
        bottom: top,
      }),
  };
}

export function useCatalogResultContextMenu() {
  const [anchorPosition, setAnchorPosition] =
    useState<ContextMenuAnchor | null>(null);

  const onContextMenu = useCallback((event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setAnchorPosition({
      top: event.clientY,
      left: event.clientX,
    });
  }, []);

  const onClose = useCallback(() => {
    setAnchorPosition(null);
  }, []);

  return {
    open: anchorPosition !== null,
    anchorPosition,
    onContextMenu,
    onClose,
  };
}

export default function CatalogResultContextMenu({
  actions,
  open,
  anchorPosition,
  onClose,
}: CatalogResultContextMenuProps & {
  open: boolean;
  anchorPosition: ContextMenuAnchor | null;
  onClose: () => void;
}) {
  const {
    canEditCatalog,
    inBin,
    binLoading,
    openDetail,
    openEdit,
    toggleBin,
  } = actions;

  const anchorEl = useMemo(
    () =>
      anchorPosition
        ? contextMenuVirtualAnchor(anchorPosition.top, anchorPosition.left)
        : null,
    [anchorPosition],
  );

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  const run = (fn: () => void) => {
    fn();
    onClose();
  };

  if (!open || !anchorEl) {
    return null;
  }

  const menu = (
    <ClickAwayListener onClickAway={onClose}>
      <Popper
        open
        anchorEl={anchorEl}
        placement="bottom-start"
        sx={{ zIndex: 10000 }}
        modifiers={[{ name: "offset", options: { offset: [0, 4] } }]}
      >
        <MenuList
          variant="outlined"
          size="sm"
          role="menu"
          sx={{
            boxShadow: (theme) => theme.shadow.md,
            bgcolor: "background.popup",
          }}
        >
          <MenuItem color="neutral" onClick={() => run(openDetail)}>
            <InfoOutlined />
            More information
          </MenuItem>
          <MenuItem
            color={inBin ? "warning" : "neutral"}
            disabled={binLoading}
            onClick={() => run(toggleBin)}
          >
            {inBin ? <Unarchive /> : <Archive />}
            {inBin ? "Remove from mail bin" : "Add to mail bin"}
          </MenuItem>
          {canEditCatalog && (
            <MenuItem color="success" onClick={() => run(openEdit)}>
              <EditOutlined />
              Edit catalog entry
            </MenuItem>
          )}
        </MenuList>
      </Popper>
    </ClickAwayListener>
  );

  return createPortal(menu, document.body);
}
