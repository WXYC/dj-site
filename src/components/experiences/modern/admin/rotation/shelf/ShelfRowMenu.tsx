"use client";

import type { JSX } from "react";
import { createPortal } from "react-dom";
import { ClickAwayListener } from "@mui/material";
import Popper from "@mui/material/Popper";
import type { VirtualElement } from "@popperjs/core";
import { Box, ListDivider, ListItemDecorator, ListSubheader, MenuItem, MenuList } from "@mui/joy";
import {
  Check,
  InfoOutlined,
  RemoveCircleOutline,
  RestoreOutlined,
} from "@mui/icons-material";
import {
  ROTATION_BINS,
  ROTATION_BIN_LABELS,
  type RotationBin,
  type RotationListRow,
} from "@/lib/features/rotation/types";
import type { RotationCard } from "@wxyc/shared";
import { RotationCardBadge } from "@/src/components/shared/RotationCardBadge";
import { rotationBinSx } from "@/lib/features/experiences/modern/tokens/roles";
import { useMenuFocus } from "@/src/hooks/useMenuFocus";
import { cardText } from "./shelfText";

export type ShelfMenuAnchor = { kind: "point"; top: number; left: number } | { kind: "element"; el: HTMLElement };

function toAnchor(anchor: ShelfMenuAnchor): VirtualElement | HTMLElement {
  if (anchor.kind === "element") return anchor.el;
  return {
    getBoundingClientRect: () =>
      DOMRect.fromRect({ x: anchor.left, y: anchor.top, width: 0, height: 0 }),
  };
}

export type ShelfRowMenuProps = {
  row: RotationListRow;
  name: string;
  anchor: ShelfMenuAnchor;
  /** `move` scopes the menu to the move sections (the row's Move button); `all` is the context menu. */
  scope: "all" | "move";
  killed: boolean;
  canOpen: boolean;
  canMoveBin: boolean;
  binCards: RotationCard[];
  disabled: boolean;
  moveLocked: boolean;
  onClose: () => void;
  onOpen: () => void;
  onMoveBin: (bin: RotationBin) => void;
  onSelectCard: (cardId: number) => void;
  onKill: () => void;
  onUnkill: () => void;
};

/**
 * One row's actions as a menu. The context menu and the row's Move button
 * open the same component, so the hover buttons, the menu, and the keyboard
 * reach one action list. Destructive items sit last, behind a divider.
 */
export default function ShelfRowMenu({
  row,
  name,
  anchor,
  scope,
  killed,
  canOpen,
  canMoveBin,
  binCards,
  disabled,
  moveLocked,
  onClose,
  onOpen,
  onMoveBin,
  onSelectCard,
  onKill,
  onUnkill,
}: ShelfRowMenuProps): JSX.Element {
  const run = (action: () => void) => () => {
    onClose();
    action();
  };
  const showMove = !killed;
  const listRef = useMenuFocus<HTMLUListElement>(anchor.kind === "element" ? anchor.el : null);

  // Joy's MenuList stamps first/last-child props onto its direct children, so
  // every item is built into one flat array: a Fragment cannot take them.
  const items: JSX.Element[] = [];
  if (scope === "all" && canOpen) {
    items.push(
      <MenuItem key="open" onClick={run(onOpen)}>
        <ListItemDecorator>
          <InfoOutlined />
        </ListItemDecorator>
        Open album
      </MenuItem>,
    );
  }
  if (showMove) {
    if (items.length > 0) items.push(<ListDivider key="d-move" />);
    items.push(
      <ListSubheader key="h-bin" sticky={false} sx={{ color: "text.tertiary" }}>
        Move to bin
      </ListSubheader>,
    );
    for (const bin of ROTATION_BINS) {
      const current = bin === row.rotation_bin;
      items.push(
        <MenuItem
          key={`bin-${bin}`}
          disabled={current || disabled || moveLocked || !canMoveBin}
          aria-label={`Move to ${ROTATION_BIN_LABELS[bin]}: ${name}`}
          onClick={run(() => onMoveBin(bin))}
        >
          <ListItemDecorator>
            <BinLetter bin={bin} />
          </ListItemDecorator>
          {ROTATION_BIN_LABELS[bin]}
          {current && <Check sx={{ ml: "auto" }} fontSize="small" />}
        </MenuItem>,
      );
    }
    if (binCards.length > 0) {
      items.push(
        <ListDivider key="d-card" />,
        <ListSubheader key="h-card" sticky={false} sx={{ color: "text.tertiary" }}>
          Card within {ROTATION_BIN_LABELS[row.rotation_bin]}
        </ListSubheader>,
      );
      for (const card of binCards) {
        const current = card.id === row.card?.id;
        items.push(
          <MenuItem
            key={`card-${card.id}`}
            disabled={current || disabled}
            aria-label={`Move to ${cardText(card)}: ${name}`}
            onClick={run(() => onSelectCard(card.id))}
          >
            <ListItemDecorator>
              <RotationCardBadge number={card.number} bin={row.rotation_bin} />
            </ListItemDecorator>
            {card.name ?? `Card ${card.number}`}
            {current && <Check sx={{ ml: "auto" }} fontSize="small" />}
          </MenuItem>,
        );
      }
    }
  }
  if (scope === "all") {
    items.push(
      <ListDivider key="d-retire" />,
      killed ? (
        <MenuItem key="restore" color="success" disabled={disabled} onClick={run(onUnkill)}>
          <ListItemDecorator>
            <RestoreOutlined />
          </ListItemDecorator>
          Restore to rotation
        </MenuItem>
      ) : (
        <MenuItem key="retire" color="warning" disabled={disabled} onClick={run(onKill)}>
          <ListItemDecorator>
            <RemoveCircleOutline />
          </ListItemDecorator>
          Retire from rotation
        </MenuItem>
      ),
    );
  }

  const content = (
    <ClickAwayListener onClickAway={onClose}>
      <Popper
        open
        anchorEl={toAnchor(anchor)}
        placement="bottom-start"
        sx={{ zIndex: 10000 }}
        modifiers={[{ name: "offset", options: { offset: [0, 4] } }]}
      >
        <MenuList
          variant="outlined"
          size="sm"
          role="menu"
          ref={listRef}
          aria-label={`Actions for ${name}`}
          onKeyDown={(event) => {
            if (event.key === "Escape" || event.key === "Tab") onClose();
          }}
          sx={{ boxShadow: "md", bgcolor: "background.popup", minWidth: 220 }}
        >
          {items}
        </MenuList>
      </Popper>
    </ClickAwayListener>
  );

  return createPortal(content, document.body);
}

function BinLetter({ bin }: { bin: RotationBin }): JSX.Element {
  return (
    <Box
      component="span"
      aria-hidden
      sx={{
        ...rotationBinSx(bin, "solid"),
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: "1.4em",
        height: "1.4em",
        borderRadius: "xs",
        fontSize: "0.75rem",
        fontWeight: "md",
      }}
    >
      {bin}
    </Box>
  );
}
