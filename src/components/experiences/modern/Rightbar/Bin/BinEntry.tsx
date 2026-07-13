import { memo, useState } from "react";
import { AlbumEntry } from "@/lib/features/catalog/types";
import { Box, Stack, Typography } from "@mui/joy";

import { ArtistAvatar } from "../../catalog/ArtistAvatar";
import BinEntryActions from "./BinEntryActions";
import BinEntryContextMenu, {
  type BinContextMenuAnchor,
} from "./BinEntryContextMenu";
import { useBinEntryActions } from "./useBinEntryActions";

/**
 * One compact Mail Bin row: the coded artist avatar, a two-line title / artist
 * stack that truncates (full text in a native `title` tooltip), hover-revealed
 * action icon buttons, and a right-click context menu opened at the cursor.
 * Memoized so unrelated rightbar state changes don't re-render the whole list.
 */
function BinEntry({ entry, live }: { entry: AlbumEntry; live: boolean }) {
  const [menuAnchor, setMenuAnchor] = useState<BinContextMenuAnchor | null>(
    null,
  );
  const actions = useBinEntryActions(entry, live);

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
        // Hover-revealed actions, absolutely pinned to the row's right edge so
        // they don't reserve layout width; always visible on touch devices.
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
        "&:hover .bin-row-actions": { opacity: 1 },
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
        <Typography
          level="title-sm"
          noWrap
          title={entry.title}
          sx={{ display: "block" }}
        >
          {entry.title}
        </Typography>
        <Typography
          level="body-sm"
          noWrap
          title={entry.artist.name}
          sx={{ display: "block", color: "text.tertiary" }}
        >
          {entry.artist.name}
        </Typography>
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
