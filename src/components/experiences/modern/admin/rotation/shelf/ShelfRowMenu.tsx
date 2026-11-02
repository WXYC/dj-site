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
          aria-label={`Actions for ${name}`}
          autoFocus
          onKeyDown={(event) => {
            if (event.key === "Escape" || event.key === "Tab") onClose();
          }}
          sx={{ boxShadow: "md", bgcolor: "background.popup", minWidth: 220 }}
        >
          {scope === "all" && canOpen && (
            <MenuItem onClick={run(onOpen)}>
              <ListItemDecorator>
                <InfoOutlined />
              </ListItemDecorator>
              Open album
            </MenuItem>
          )}
          {showMove && (
            <>
              {scope === "all" && canOpen && <ListDivider />}
              <ListSubheader sticky={false} sx={{ color: "text.tertiary" }}>
                Move to bin
              </ListSubheader>
              {ROTATION_BINS.map((bin) => {
                const current = bin === row.rotation_bin;
                return (
                  <MenuItem
                    key={bin}
                    disabled={current || disabled || moveLocked || !canMoveBin}
                    aria-label={`Move to ${ROTATION_BIN_LABELS[bin]}: ${name}`}
                    onClick={run(() => onMoveBin(bin))}
                  >
                    <ListItemDecorator>
                      <BinLetter bin={bin} />
                    </ListItemDecorator>
                    {ROTATION_BIN_LABELS[bin]}
                    {current && <Check sx={{ ml: "auto" }} fontSize="small" />}
                  </MenuItem>
                );
              })}
              {binCards.length > 0 && (
                <>
                  <ListDivider />
                  <ListSubheader sticky={false} sx={{ color: "text.tertiary" }}>
                    Card within {ROTATION_BIN_LABELS[row.rotation_bin]}
                  </ListSubheader>
                  {binCards.map((card) => {
                    const current = card.id === row.card?.id;
                    return (
                      <MenuItem
                        key={card.id}
                        disabled={current || disabled}
                        aria-label={`Move to ${cardText(card)}: ${name}`}
                        onClick={run(() => onSelectCard(card.id))}
                      >
                        <ListItemDecorator>
                          <RotationCardBadge number={card.number} bin={row.rotation_bin} />
                        </ListItemDecorator>
                        {card.name ?? `Card ${card.number}`}
                        {current && <Check sx={{ ml: "auto" }} fontSize="small" />}
                      </MenuItem>
                    );
                  })}
                </>
              )}
            </>
          )}
          {scope === "all" && (
            <>
              <ListDivider />
              {killed ? (
                <MenuItem color="success" disabled={disabled} onClick={run(onUnkill)}>
                  <ListItemDecorator>
                    <RestoreOutlined />
                  </ListItemDecorator>
                  Unkill
                </MenuItem>
              ) : (
                <MenuItem color="warning" disabled={disabled} onClick={run(onKill)}>
                  <ListItemDecorator>
                    <RemoveCircleOutline />
                  </ListItemDecorator>
                  Kill from rotation
                </MenuItem>
              )}
            </>
          )}
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
