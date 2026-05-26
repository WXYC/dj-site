"use client";

import {
  Archive,
  Check,
  EditOutlined,
  InfoOutlined,
  Unarchive,
} from "@mui/icons-material";
import { ClickAwayListener } from "@mui/material";
import Popper from "@mui/material/Popper";
import { ListDivider, ListSubheader, MenuItem, MenuList } from "@mui/joy";
import type { Rotation } from "@/lib/features/rotation/types";
import {
  ROTATION_BINS,
  ROTATION_BIN_LABELS,
} from "@/src/utilities/modern/rotationBinColors";
import { catalogSlice } from "@/lib/features/catalog/frontend";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import type { VirtualElement } from "@popperjs/core";
import { useCallback, useEffect, useMemo } from "react";
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

export function useCatalogResultContextMenu(albumId: number) {
  const dispatch = useAppDispatch();
  const menu = useAppSelector(catalogSlice.selectors.getResultContextMenu);
  const isOpen = menu?.albumId === albumId;

  const onContextMenu = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
      dispatch(
        catalogSlice.actions.openResultContextMenu({
          albumId,
          top: event.clientY,
          left: event.clientX,
        }),
      );
    },
    [albumId, dispatch],
  );

  const onClose = useCallback(() => {
    dispatch(catalogSlice.actions.closeResultContextMenu());
  }, [dispatch]);

  const anchorPosition: ContextMenuAnchor | null = isOpen
    ? { top: menu.top, left: menu.left }
    : null;

  return {
    open: isOpen,
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
    canMarkRotation,
    displayRotationBin,
    rotationLoading,
    setRotationBin,
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

  const runRotation = async (bin: Rotation | null) => {
    await setRotationBin(bin);
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
          {canMarkRotation && <ListDivider />}
          {canMarkRotation && (
            <ListSubheader sticky={false} sx={{ color: "text.tertiary" }}>
              Rotation
            </ListSubheader>
          )}
          {canMarkRotation &&
            ROTATION_BINS.map((bin) => {
              const isActive = displayRotationBin === bin;
              return (
                <MenuItem
                  key={bin}
                  color="neutral"
                  disabled={rotationLoading}
                  onClick={() => runRotation(isActive ? null : bin)}
                >
                  {isActive ? <Check /> : null}
                  {ROTATION_BIN_LABELS[bin]} ({bin})
                </MenuItem>
              );
            })}
          {canMarkRotation && displayRotationBin && (
            <MenuItem
              color="warning"
              disabled={rotationLoading}
              onClick={() => runRotation(null)}
            >
              Remove from rotation
            </MenuItem>
          )}
        </MenuList>
      </Popper>
    </ClickAwayListener>
  );

  return createPortal(menu, document.body);
}
