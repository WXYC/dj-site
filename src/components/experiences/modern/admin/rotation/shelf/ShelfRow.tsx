"use client";

import type { JSX } from "react";
import { useState } from "react";
import { Box, Chip, IconButton, Stack, Tooltip, Typography } from "@mui/joy";
import {
  InfoOutlined,
  Link as LinkIcon,
  RemoveCircleOutline,
  RestoreOutlined,
  SwapHoriz,
} from "@mui/icons-material";
import type { RotationCard } from "@wxyc/shared";
import { daysInBin, daysPastWindow, isPastWindow } from "@/lib/features/rotation/age";
import { canMoveRotationRow, rotationRowPresentation } from "@/lib/features/rotation/adminList";
import { formatRotationDate } from "@/lib/features/rotation/classicList";
import { rotationLocationFor } from "@/lib/features/rotation/location";
import {
  ROTATION_BIN_LABELS,
  type RotationBin,
  type RotationListRow,
  type RotationWindowDays,
} from "@/lib/features/rotation/types";
import { STATUS_CHIP_SX } from "@/lib/features/experiences/modern/tokens/roles";
import { RecordArtwork } from "@/src/components/experiences/modern/catalog/AlbumArtwork";
import { RotationLocationPill } from "@/src/components/experiences/modern/catalog/Results/RotationLocationPill";
import { rowActionsClusterSx, tabularNumsSx } from "@/src/utilities/modern/recordTableSx";
import ShelfRowMenu, { type ShelfMenuAnchor } from "./ShelfRowMenu";
import { shelfRowName } from "./shelfText";

const clampSx = {
  display: "-webkit-box",
  WebkitLineClamp: 2,
  WebkitBoxOrient: "vertical",
  overflow: "hidden",
} as const;

export type ShelfRowProps = {
  row: RotationListRow;
  /** The row's own bin's cards: the card items are a within-bin move only. */
  binCards: RotationCard[];
  pending: boolean;
  /** Disables cross-bin moves beyond this row's own pending state. */
  moveLocked: boolean;
  now: Date;
  /** `null` while the windows read is pending or failed, which withholds the overdue chip. */
  windows: RotationWindowDays | null;
  /** Hide the location cell where the group header already names bin and card. */
  showLocation?: boolean;
  onOpen: (albumId: number) => void;
  onKill: () => void;
  onUnkill: () => void;
  onSelectCard: (cardId: number) => void;
  onMoveBin: (bin: RotationBin) => void;
};

/**
 * One record on the rotation shelf, in the catalog's media-object row
 * anatomy: artwork, title over artist, the record's physical location in
 * place of its call number (a rotating release is not on the stacks), and its
 * age in the bin. Actions are quiet until the row is hovered or focused, and
 * the same actions open from a right-click or the keyboard's menu key.
 *
 * Unlinked rows (`id: null`, a release never catalogued) carry only their
 * snapshot fields: no album to open, and every action names the row by
 * `rotation_id`, never a library record.
 */
export default function ShelfRow({
  row,
  binCards,
  pending,
  moveLocked,
  now,
  windows,
  showLocation = true,
  onOpen,
  onKill,
  onUnkill,
  onSelectCard,
  onMoveBin,
}: ShelfRowProps): JSX.Element {
  const [menu, setMenu] = useState<{ anchor: ShelfMenuAnchor; scope: "all" | "move" } | null>(null);
  const killed = rotationRowPresentation(row) === "killed";
  // A killed row left its bin on its kill date, so an age counted to today
  // would be false: age applies to the active presentation only.
  const age = killed ? null : daysInBin(row, now);
  const windowDays = windows?.[row.rotation_bin];
  const overdue = !killed && windowDays != null && isPastWindow(row, windowDays, now);
  const daysOver = overdue ? daysPastWindow(row, windowDays, now) : null;
  const urls = row.urls ?? [];
  const name = shelfRowName(row);
  const location = rotationLocationFor(row.rotation_bin, row.card);
  const canOpen = row.id != null;
  const canMoveBin = canMoveRotationRow(row);

  const openMenuAt = (anchor: ShelfMenuAnchor, scope: "all" | "move") => setMenu({ anchor, scope });

  return (
    <tr
      className="record-row"
      tabIndex={0}
      aria-label={`${row.album_title ?? ""} — ${row.artist_name ?? ""}`}
      data-testid={`rotation-admin-row-${row.rotation_id}`}
      onContextMenu={(event) => {
        event.preventDefault();
        openMenuAt({ kind: "point", top: event.clientY, left: event.clientX }, "all");
      }}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return;
        if (event.key === "ContextMenu" || (event.shiftKey && event.key === "F10")) {
          event.preventDefault();
          openMenuAt({ kind: "element", el: event.currentTarget }, "all");
        } else if (event.key === "Enter" && canOpen) {
          onOpen(row.id!);
        }
      }}
      style={{ opacity: pending ? 0.6 : 1 }}
    >
      <td style={{ width: 76, paddingRight: 0 }}>
        <RecordArtwork
          artworkUrl={row.artwork_url}
          genre={row.genre_name}
          lettercode={row.code_letters}
          alt={`${row.artist_name ?? ""} - ${row.album_title ?? ""}`}
          size={52}
        />
      </td>
      <td>
        <Typography level="title-sm" sx={clampSx} textColor={killed ? "text.secondary" : undefined}>
          {row.album_title ?? "—"}
        </Typography>
        <Typography level="body-sm" textColor="text.secondary" sx={clampSx}>
          {row.artist_name ?? ""}
        </Typography>
      </td>
      {showLocation && (
        <td style={{ width: 120 }}>{location && <RotationLocationPill location={location} />}</td>
      )}
      <td style={{ width: 110, textAlign: "right" }}>
        {killed ? (
          <Typography level="body-xs" textColor="text.tertiary" sx={tabularNumsSx}>
            retired {formatRotationDate(row.rotation_kill_date)}
          </Typography>
        ) : (
          <Stack alignItems="flex-end" spacing={0.25}>
            {/* A future-dated add, or a client clock briefly behind the server's
                right after UTC midnight, yields a negative age: shown as no age
                rather than "-1 d". */}
            <Tooltip
              variant="outlined"
              size="sm"
              title={`Added ${formatRotationDate(row.rotation_add_date)}${
                age != null && age >= 0
                  ? ` · ${age} day${age === 1 ? "" : "s"} in ${ROTATION_BIN_LABELS[row.rotation_bin]}`
                  : ""
              }`}
            >
              <Typography level="body-sm" textColor="text.secondary" sx={tabularNumsSx} tabIndex={-1}>
                {age != null && age >= 0 ? `${age} d` : "—"}
              </Typography>
            </Tooltip>
            {overdue && (
              <Chip size="sm" variant="soft" color="warning" sx={{ ...STATUS_CHIP_SX, ...tabularNumsSx }}>
                {daysOver} over
              </Chip>
            )}
          </Stack>
        )}
      </td>
      <td style={{ width: 56, textAlign: "right" }}>
        {urls.length > 0 && (
          // A count with the values as tooltip text, never an anchor: MDs paste
          // bare domains, so a value carries no scheme guarantee and must not be
          // bound into an href unchecked.
          <Tooltip
            variant="outlined"
            size="sm"
            title={<Box sx={{ whiteSpace: "pre-line" }}>{urls.join("\n")}</Box>}
          >
            <Typography
              level="body-xs"
              textColor="text.tertiary"
              startDecorator={<LinkIcon fontSize="inherit" />}
              tabIndex={0}
              aria-label={`${urls.length} link${urls.length === 1 ? "" : "s"}: ${urls.join(", ")}`}
              sx={{ ...tabularNumsSx, justifyContent: "flex-end" }}
            >
              {urls.length}
            </Typography>
          </Tooltip>
        )}
      </td>
      <td className="actions-cell">
        <Stack direction="row" gap={0.25} className="row-actions" sx={rowActionsClusterSx}>
          {canOpen && (
            <Tooltip variant="outlined" size="sm" title="Open album">
              <IconButton
                size="sm"
                variant="plain"
                color="neutral"
                aria-label={`Open: ${name}`}
                onClick={() => onOpen(row.id!)}
              >
                <InfoOutlined />
              </IconButton>
            </Tooltip>
          )}
          {!killed && (
            <Tooltip variant="outlined" size="sm" title="Move to another bin or card">
              <IconButton
                size="sm"
                variant="plain"
                color="neutral"
                disabled={pending}
                aria-label={`Move: ${name}`}
                aria-haspopup="menu"
                onClick={(event) => openMenuAt({ kind: "element", el: event.currentTarget }, "move")}
              >
                <SwapHoriz />
              </IconButton>
            </Tooltip>
          )}
          {killed ? (
            <Tooltip variant="outlined" size="sm" title="Restore to rotation">
              <IconButton
                size="sm"
                variant="plain"
                color="success"
                disabled={pending}
                aria-label={`Restore: ${name}`}
                onClick={onUnkill}
              >
                <RestoreOutlined />
              </IconButton>
            </Tooltip>
          ) : (
            <Tooltip variant="outlined" size="sm" title="Retire from rotation">
              <IconButton
                size="sm"
                variant="plain"
                color="warning"
                disabled={pending}
                aria-label={`Retire: ${name}`}
                onClick={onKill}
              >
                <RemoveCircleOutline />
              </IconButton>
            </Tooltip>
          )}
        </Stack>
        {menu && (
          <ShelfRowMenu
            row={row}
            name={name}
            anchor={menu.anchor}
            scope={menu.scope}
            killed={killed}
            canOpen={canOpen}
            canMoveBin={canMoveBin}
            binCards={binCards}
            disabled={pending}
            moveLocked={moveLocked}
            onClose={() => setMenu(null)}
            onOpen={() => canOpen && onOpen(row.id!)}
            onMoveBin={onMoveBin}
            onSelectCard={onSelectCard}
            onKill={onKill}
            onUnkill={onUnkill}
          />
        )}
      </td>
    </tr>
  );
}
