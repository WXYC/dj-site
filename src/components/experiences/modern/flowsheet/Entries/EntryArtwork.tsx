"use client";

import { FlowsheetSongEntry } from "@/lib/features/flowsheet/types";
import { NotOnDiscogsBadge } from "@/src/components/experiences/modern/catalog/AlbumArtwork";
import { AspectRatio, Typography } from "@mui/joy";
import { ReactNode } from "react";

/**
 * The two artwork shapes a flowsheet row's first cell can hold: a song's
 * AspectRatio/image switch and a message row's AspectRatio'd icon. No
 * motion, no live-show hooks, so a server-rendered read-only row can render
 * either directly; the drag grip and, on a queue row, the Play-now button
 * stay with the caller's `<td>` since neither artwork carries that state.
 */

export function SongEntryArtwork({ entry }: { entry: FlowsheetSongEntry }) {
  const image = entry.artwork_url ?? "/img/cassette.png";

  return (
    <AspectRatio
      ratio={1}
      sx={{
        flexBasis: "calc(60px - 12px)",
        borderRadius: "9px",
        minWidth: "48px",
        minHeight: "48px",
      }}
    >
      {entry.discogsUnavailable === true ? (
        <NotOnDiscogsBadge size={48} note={entry.discogsUnavailableNote} />
      ) : (
        <img src={image} alt="album art" style={{ minWidth: "48px", minHeight: "48px" }} />
      )}
    </AspectRatio>
  );
}

export function MarkerEntryArtwork({ icon }: { icon: ReactNode }) {
  return (
    <AspectRatio
      ratio={1.5}
      variant="plain"
      sx={{
        flexBasis: "calc(60px - 12px)",
        borderRadius: "9px",
        minWidth: "48px",
        minHeight: "20px",
      }}
    >
      <Typography>{icon}</Typography>
    </AspectRatio>
  );
}
