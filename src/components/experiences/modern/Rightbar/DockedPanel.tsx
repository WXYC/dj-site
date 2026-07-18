"use client";

import { Box, Sheet } from "@mui/joy";
import { ReactNode, useState } from "react";
import { DOCK_PANEL_WIDTH } from "../catalog/album/dock";

/**
 * The animated slot between Main and the pinned rail. It stays mounted while
 * the rail exists so swapping content (home panel <-> album card) never
 * replays the entry animation; only the collapsed<->open edge animates.
 */
export default function DockedPanel({ content }: { content: ReactNode | null }) {
  const open = content !== null;

  // The outgoing content must stay mounted while the width animates shut;
  // the transition's end unmounts it.
  const [cached, setCached] = useState<ReactNode>(null);
  if (open && content !== cached) {
    setCached(content);
  }

  return (
    <Box
      onTransitionEnd={(event) => {
        if (!open && event.propertyName === "width") {
          setCached(null);
        }
      }}
      sx={{
        position: "sticky",
        top: 0,
        height: "100dvh",
        flexShrink: 0,
        overflow: "hidden",
        width: open ? DOCK_PANEL_WIDTH : 0,
        transition: "width 0.4s",
      }}
    >
      <Sheet
        className="DockedPanel"
        sx={{
          width: DOCK_PANEL_WIDTH,
          height: "100%",
          minWidth: 0,
          borderLeft: "1px solid",
          borderColor: "divider",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {content ?? cached}
      </Sheet>
    </Box>
  );
}
