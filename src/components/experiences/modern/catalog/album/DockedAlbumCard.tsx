"use client";

import { applicationSlice } from "@/lib/features/application/frontend";
import { useAppDispatch } from "@/lib/hooks";
import DockedPanelHeader from "@/src/components/experiences/modern/Rightbar/DockedPanelHeader";
import { PushPin } from "@mui/icons-material";
import { Box, IconButton, Tooltip } from "@mui/joy";
import AlbumDetailContent from "./AlbumDetailContent";
import { RIGHTBAR_FOOTER_CLEARANCE } from "./dock";

/**
 * A pinned album's card, rendered inside the docked panel. Collapse is the
 * dock-wide state — the URL keeps the album, so reopening from the rail is a
 * pure state flip. Unpinning hands the presentation back to the centered
 * modal.
 */
export default function DockedAlbumCard({ albumId }: { albumId: number }) {
  const dispatch = useAppDispatch();

  return (
    <>
      <DockedPanelHeader
        onCollapse={() => dispatch(applicationSlice.actions.setDockView("collapsed"))}
      >
        <Tooltip variant="outlined" size="sm" title="Unpin card">
          <IconButton
            aria-label="Unpin card"
            size="sm"
            variant="soft"
            color="neutral"
            onClick={() => dispatch(applicationSlice.actions.unpinAlbum(albumId))}
          >
            <PushPin />
          </IconButton>
        </Tooltip>
      </DockedPanelHeader>
      <Box sx={{ flex: 1, minHeight: 0, overflowY: "auto", p: 2 }}>
        <AlbumDetailContent albumId={albumId} />
      </Box>
      <Box sx={{ minHeight: `${RIGHTBAR_FOOTER_CLEARANCE}px`, flexShrink: 0 }} />
    </>
  );
}
