import { memo, useState } from "react";
import { AlbumEntry } from "@/lib/features/catalog/types";
import { Box, Stack, Tooltip, Typography } from "@mui/joy";

import { ArtistAvatar } from "../../catalog/ArtistAvatar";
import BinEntryActions from "./BinEntryActions";
import BinEntryContextMenu, {
  type BinContextMenuAnchor,
} from "./BinEntryContextMenu";
import {
  useBinEntryActions,
  type BinEntryActionDeps,
} from "./useBinEntryActions";

/**
 * One compact Mail Bin row: the coded artist avatar, a two-line title / artist
 * stack that truncates (full text in a real Joy Tooltip — the native `title`
 * attr surfaces unreliably across browsers), hover/focus-revealed action icon
 * buttons, and a right-click context menu opened at the cursor.
 * Memoized so unrelated rightbar state changes don't re-render the whole list.
 */
function BinEntry({
  entry,
  live,
  actionDeps,
}: {
  entry: AlbumEntry;
  live: boolean;
  actionDeps: BinEntryActionDeps;
}) {
  const [menuAnchor, setMenuAnchor] = useState<BinContextMenuAnchor | null>(
    null,
  );
  const actions = useBinEntryActions(entry, live, actionDeps);

  return (
    <Stack
      direction="row"
      spacing={1}
      alignItems="center"
      onContextMenu={(e) => {
        e.preventDefault();
        setMenuAnchor({ top: e.clientY, left: e.clientX });
      }}
      sx={{
        position: "relative",
        py: 0.5,
        minWidth: 0,
        maxWidth: "100%",
        // Hover/focus-revealed actions, absolutely pinned to the row's right
        // edge so they don't reserve layout width; always visible on touch
        // devices. `:focus-within` keeps keyboard-focused buttons visible —
        // a Tab stop must never land on an invisible control.
        "& .bin-row-actions": {
          position: "absolute",
          right: 2,
          top: "50%",
          transform: "translateY(-50%)",
          borderRadius: "sm",
          bgcolor: "background.surface",
          boxShadow: "sm",
          px: 0.25,
          opacity: 0,
          transition: "opacity 0.15s",
          "@media (hover: none)": { opacity: 1 },
        },
        "&:hover .bin-row-actions, &:focus-within .bin-row-actions": {
          opacity: 1,
        },
      }}
    >
      <Box sx={{ flexShrink: 0 }}>
        <ArtistAvatar
          entry={entry.entry}
          artist={entry.artist}
          format={entry.format}
        />
      </Box>
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Tooltip
          title={entry.title}
          variant="outlined"
          size="sm"
          placement="top-start"
          enterDelay={400}
        >
          <Typography level="title-sm" noWrap sx={{ display: "block" }}>
            {entry.title}
          </Typography>
        </Tooltip>
        <Tooltip
          title={entry.artist.name}
          variant="outlined"
          size="sm"
          placement="top-start"
          enterDelay={400}
        >
          <Typography
            level="body-sm"
            noWrap
            sx={{ display: "block", color: "text.tertiary" }}
          >
            {entry.artist.name}
          </Typography>
        </Tooltip>
      </Box>
      <BinEntryActions actions={actions} className="bin-row-actions" />
      <BinEntryContextMenu
        actions={actions}
        anchor={menuAnchor}
        onClose={() => setMenuAnchor(null)}
      />
    </Stack>
  );
}

export default memo(BinEntry);
