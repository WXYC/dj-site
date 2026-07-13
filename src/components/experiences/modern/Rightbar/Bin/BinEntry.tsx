import { memo } from "react";
import { AlbumEntry } from "@/lib/features/catalog/types";
import { Box, Stack, Typography } from "@mui/joy";

import { ArtistAvatar } from "../../catalog/ArtistAvatar";
import BinMenu from "./BinMenu";

/**
 * One compact Mail Bin row: the coded artist avatar, a two-line
 * title / artist stack that truncates (full text in a native `title`
 * tooltip), and the per-entry action menu. Memoized so unrelated
 * rightbar state changes don't re-render the whole list.
 */
function BinEntry({ entry }: { entry: AlbumEntry }) {
  return (
    <Stack
      direction="row"
      spacing={1}
      alignItems="center"
      sx={{
        py: 0.5,
        minWidth: 0,
        maxWidth: "100%",
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
      <BinMenu entry={entry} />
    </Stack>
  );
}

export default memo(BinEntry);
