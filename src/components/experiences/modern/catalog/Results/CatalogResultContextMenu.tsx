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
import {
  useAddRotationEntryMutation,
  useKillRotationEntryMutation,
} from "@/lib/features/rotation/api";
import { AlbumEntry } from "@/lib/features/catalog/types";
import { isUnmessagedHttpError } from "@/lib/rtk-query-error-logger";
import { RequireMD } from "@/src/components/shared/Authorization";
import { useAlbumRotationEntries } from "@/src/components/experiences/modern/catalog/album/useAlbumRotationEntries";
import { useBin, useAddToBin, useDeleteFromBin } from "@/src/hooks/binHooks";
import type { VirtualElement } from "@popperjs/core";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";

export type ContextMenuAnchor = { top: number; left: number };

export type CatalogResultContextMenuState = {
  album: AlbumEntry;
  top: number;
  left: number;
};

function contextMenuVirtualAnchor(top: number, left: number): VirtualElement {
  return {
    getBoundingClientRect: () =>
      DOMRect.fromRect({
        x: left,
        y: top,
        width: 0,
        height: 0,
      }),
  };
}

/**
 * Right-click menu on a catalog result row. Menu state is owned by the
 * results list (one open menu at a time, unmounted when closed), so every
 * action can simply act and close — nothing here survives dismissal.
 */
export default function CatalogResultContextMenu({
  menu,
  onClose,
}: {
  menu: CatalogResultContextMenuState;
  onClose: () => void;
}) {
  const router = useRouter();
  const { album } = menu;

  const { bin, loading: binListLoading } = useBin();
  const { addToBin, loading: addBinLoading } = useAddToBin();
  const { deleteFromBin, loading: deleteBinLoading } = useDeleteFromBin();

  const inBin = Boolean(bin?.find((item) => item.id === album.id));
  const binLoading = binListLoading || addBinLoading || deleteBinLoading;

  const anchorEl = useMemo(
    () => contextMenuVirtualAnchor(menu.top, menu.left),
    [menu.top, menu.left],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const run = (fn: () => void) => {
    fn();
    onClose();
  };

  const openDetail = () => {
    if (album.id != null) router.push(`/dashboard/album/${album.id}`);
  };

  const toggleBin = () => {
    // Catalog rows always carry a real library.id; only LML rows go null.
    if (album.id == null) return;
    if (inBin) deleteFromBin(album.id);
    else addToBin(album.id);
  };

  const content = (
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
          aria-label={`Actions for ${album.title}`}
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
          <RequireMD>
            <MenuItem color="success" onClick={() => run(openDetail)}>
              <EditOutlined />
              Edit catalog entry
            </MenuItem>
            <RotationMenuSection album={album} onClose={onClose} />
          </RequireMD>
        </MenuList>
      </Popper>
    </ClickAwayListener>
  );

  return createPortal(content, document.body);
}

/**
 * MD-only rotation section. Mounts inside `RequireMD` so the rotation-list
 * subscription only runs for an authorized viewer with the menu open — and it
 * joins the shared cache entry rather than refetching it (see
 * `useAlbumRotationEntries`).
 */
function RotationMenuSection({
  album,
  onClose,
}: {
  album: AlbumEntry;
  onClose: () => void;
}) {
  const { activeEntries, albumIdValid, rotationStateUnknown, rotationFetching } =
    useAlbumRotationEntries(album);
  const [addRotationEntry] = useAddRotationEntryMutation();
  const [killRotationEntry] = useKillRotationEntryMutation();
  const [mutating, setMutating] = useState(false);

  if (!albumIdValid) return null;

  const activeBins = new Set(activeEntries.map((entry) => entry.rotation_bin));

  // Undecidable until the first rotation load lands: render the section
  // disabled rather than offering an add against unknown membership, which
  // could open a duplicate active entry (the backend's insert has no dedupe).
  const busy = rotationStateUnknown || rotationFetching || mutating;

  const setRotation = async (bin: Rotation | null) => {
    setMutating(true);
    try {
      // Re-binning and removal both retire every active entry first; the
      // backend keeps prior unkilled entries as genuinely active rows, so a
      // plain add would stack a second bin on top of the first.
      for (const entry of activeEntries) {
        // `kill_date` is omitted so the server dates the kill itself; a
        // browser-computed UTC date is already tomorrow during Eastern
        // evenings and would leave the entry selectable for another day.
        await killRotationEntry({ rotation_id: entry.rotation_id }).unwrap();
      }
      if (bin) {
        // Guarded by the `albumIdValid` check above.
        await addRotationEntry({ album_id: album.id!, rotation_bin: bin }).unwrap();
        toast.success(`Marked for ${bin} rotation.`);
      } else {
        toast.success("Removed from rotation.");
      }
    } catch (err) {
      if (isUnmessagedHttpError(err)) {
        toast.error("Could not update rotation.");
      }
    } finally {
      setMutating(false);
      onClose();
    }
  };

  return (
    <>
      <ListDivider />
      <ListSubheader sticky={false} sx={{ color: "text.tertiary" }}>
        {rotationStateUnknown ? "Rotation — checking status…" : "Rotation"}
      </ListSubheader>
      {ROTATION_BINS.map((bin) => {
        const isActive = activeBins.has(bin);
        return (
          <MenuItem
            key={bin}
            color="neutral"
            disabled={busy}
            onClick={() => setRotation(isActive ? null : bin)}
          >
            {isActive ? <Check /> : null}
            {ROTATION_BIN_LABELS[bin]} ({bin})
          </MenuItem>
        );
      })}
      {activeBins.size > 0 && (
        <MenuItem color="warning" disabled={busy} onClick={() => setRotation(null)}>
          Remove from rotation
        </MenuItem>
      )}
    </>
  );
}
