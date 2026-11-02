"use client";

import type { JSX } from "react";
import { useState } from "react";
import { createPortal } from "react-dom";
import { ClickAwayListener } from "@mui/material";
import Popper from "@mui/material/Popper";
import {
  Button,
  IconButton,
  Input,
  ListItemContent,
  ListItemDecorator,
  MenuItem,
  MenuList,
  Stack,
  Tooltip,
  Typography,
} from "@mui/joy";
import {
  AssignmentTurnedInOutlined,
  DeleteOutline,
  EditOutlined,
  MoreHoriz,
  TimerOutlined,
} from "@mui/icons-material";
import { rotationCardName } from "@/lib/features/rotation/cards";
import type { RotationBin, RotationCardWithCount } from "@/lib/features/rotation/types";
import { RotationCardBadge } from "@/src/components/shared/RotationCardBadge";
import { tabularNumsSx } from "@/src/utilities/modern/recordTableSx";

export type ShelfCardHeaderProps = {
  card: RotationCardWithCount;
  bin: RotationBin;
  colSpan: number;
  /** Days since the newest add or kill on this card; `null` when nothing has ever touched it. */
  lastActivityDays: number | null;
  /** Past the station's card staleness threshold. */
  stale: boolean;
  deletable: boolean;
  pending: boolean;
  onRename: (name: string | null) => void;
  onDelete: () => void;
  onAssign: () => void;
};

const DELETE_RULE = "Only a bin's last card can be deleted, when it holds no active releases — and never its only card.";

/**
 * A card's group header in the shelf's By-card view: the card as a physical
 * divider in its bin. Rename is on demand (pencil on hover, double-click, or
 * the menu), not a standing input; Assign records opens the walk-the-shelf
 * panel; delete lives only in the menu, labelled, with the rule it follows
 * shown when it can't run.
 */
export default function ShelfCardHeader({
  card,
  bin,
  colSpan,
  lastActivityDays,
  stale,
  deletable,
  pending,
  onRename,
  onDelete,
  onAssign,
}: ShelfCardHeaderProps): JSX.Element {
  const [editing, setEditing] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const cardName = rotationCardName(bin, card.number);

  const commit = (raw: string) => {
    setEditing(false);
    const next = raw.trim() || null;
    if (next !== (card.name ?? null)) onRename(next);
  };

  return (
    <tr className="card-header" data-testid={`rotation-card-${card.id}`}>
      <th colSpan={colSpan} scope="colgroup">
        <Stack
          direction="row"
          spacing={1.25}
          alignItems="center"
          sx={{
            "& .card-header-edit": { opacity: 0, transition: "opacity 120ms" },
            "&:hover .card-header-edit, &:focus-within .card-header-edit": { opacity: 1 },
            "@media (hover: none)": { "& .card-header-edit": { opacity: 1 } },
          }}
        >
          <RotationCardBadge number={card.number} bin={bin} />
          {editing ? (
            <Input
              size="sm"
              variant="plain"
              autoFocus
              placeholder="unnamed"
              defaultValue={card.name ?? ""}
              sx={{
                maxWidth: 260,
                "--Input-focusedThickness": "0px",
                borderBottom: "1px solid",
                borderColor: "primary.500",
                borderRadius: 0,
              }}
              slotProps={{
                input: {
                  "aria-label": `Name for ${cardName}`,
                  onBlur: (event) => commit(event.currentTarget.value),
                  onKeyDown: (event) => {
                    if (event.key === "Enter") event.currentTarget.blur();
                    if (event.key === "Escape") setEditing(false);
                  },
                },
              }}
            />
          ) : (
            <Typography
              level="title-sm"
              textColor={card.name ? "text.primary" : "text.tertiary"}
              onDoubleClick={() => !pending && setEditing(true)}
            >
              {card.name ?? "Unnamed"}
            </Typography>
          )}
          {!editing && (
            <IconButton
              className="card-header-edit"
              size="sm"
              variant="plain"
              color="neutral"
              disabled={pending}
              aria-label={`Rename ${cardName}`}
              onClick={() => setEditing(true)}
              sx={{ "--IconButton-size": "24px" }}
            >
              <EditOutlined sx={{ fontSize: 15 }} />
            </IconButton>
          )}
          <Typography level="body-xs" textColor="text.tertiary" sx={tabularNumsSx}>
            {card.active_count} active
          </Typography>
          <Tooltip
            variant="outlined"
            size="sm"
            title={stale ? "Nothing added or retired on this card in a while" : "Days since anything was added or retired here"}
          >
            <Typography
              level="body-xs"
              textColor={stale ? "warning.plainColor" : "text.tertiary"}
              startDecorator={stale ? <TimerOutlined sx={{ fontSize: 14 }} /> : undefined}
              sx={tabularNumsSx}
              tabIndex={0}
            >
              {lastActivityDays == null ? "never touched" : `touched ${lastActivityDays} d ago`}
            </Typography>
          </Tooltip>
          <Stack direction="row" spacing={0.5} sx={{ ml: "auto" }}>
            <Button
              size="sm"
              variant="plain"
              color="neutral"
              startDecorator={<AssignmentTurnedInOutlined fontSize="small" />}
              disabled={pending}
              aria-label={`Assign records: ${cardName}`}
              onClick={onAssign}
            >
              Assign records
            </Button>
            <IconButton
              size="sm"
              variant="plain"
              color="neutral"
              aria-label={`More for ${cardName}`}
              aria-haspopup="menu"
              onClick={(event) => setMenuAnchor(event.currentTarget)}
            >
              <MoreHoriz />
            </IconButton>
          </Stack>
        </Stack>
        {menuAnchor &&
          createPortal(
            <ClickAwayListener onClickAway={() => setMenuAnchor(null)}>
              <Popper open anchorEl={menuAnchor} placement="bottom-end" sx={{ zIndex: 10000 }}>
                <MenuList
                  variant="outlined"
                  size="sm"
                  autoFocus
                  aria-label={`Actions for ${cardName}`}
                  onKeyDown={(event) => {
                    if (event.key === "Escape" || event.key === "Tab") setMenuAnchor(null);
                  }}
                  sx={{ boxShadow: "md", bgcolor: "background.popup", minWidth: 240 }}
                >
                  <MenuItem
                    onClick={() => {
                      setMenuAnchor(null);
                      setEditing(true);
                    }}
                  >
                    <ListItemDecorator>
                      <EditOutlined />
                    </ListItemDecorator>
                    Rename
                  </MenuItem>
                  <MenuItem
                    color="warning"
                    disabled={!deletable || pending}
                    aria-label={`Delete: ${cardName}`}
                    onClick={() => {
                      setMenuAnchor(null);
                      onDelete();
                    }}
                  >
                    <ListItemDecorator>
                      <DeleteOutline />
                    </ListItemDecorator>
                    <ListItemContent>
                      Delete {cardName}
                      {!deletable && (
                        <Typography level="body-xs" textColor="text.tertiary" sx={{ whiteSpace: "normal" }}>
                          {DELETE_RULE}
                        </Typography>
                      )}
                    </ListItemContent>
                  </MenuItem>
                </MenuList>
              </Popper>
            </ClickAwayListener>,
            document.body,
          )}
      </th>
    </tr>
  );
}
