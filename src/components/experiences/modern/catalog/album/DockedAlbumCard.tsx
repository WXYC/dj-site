"use client";

import { applicationSlice } from "@/lib/features/application/frontend";
import { albumParentPath } from "@/lib/features/catalog/albumRoutes";
import { useAppDispatch } from "@/lib/hooks";
import DockedPanelHeader from "@/src/components/experiences/modern/Rightbar/DockedPanelHeader";
import { PushPin } from "@mui/icons-material";
import { Box, IconButton, Tooltip } from "@mui/joy";
import { usePathname, useRouter } from "next/navigation";
import AlbumDetailContent from "./AlbumDetailContent";
import { RIGHTBAR_FOOTER_CLEARANCE } from "./dock";

/**
 * A pinned album's card, rendered inside the docked panel. Collapsing strips
 * the /album segment (the icon stays in the rail); unpinning hands the
 * presentation back to the centered modal.
 */
export default function DockedAlbumCard({ albumId }: { albumId: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const dispatch = useAppDispatch();

  const collapseDock = () => {
    dispatch(applicationSlice.actions.setDockView("collapsed"));
    router.push(albumParentPath(pathname));
  };

  return (
    <>
      <DockedPanelHeader onCollapse={collapseDock}>
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
