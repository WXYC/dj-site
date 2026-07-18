"use client";

import { applicationSlice } from "@/lib/features/application/frontend";
import { albumParentPath } from "@/lib/features/catalog/albumRoutes";
import { useAppDispatch } from "@/lib/hooks";
import { Close, PushPin } from "@mui/icons-material";
import { Box, Divider, IconButton, Sheet, Tooltip } from "@mui/joy";
import { usePathname, useRouter } from "next/navigation";
import AlbumDetailContent from "./AlbumDetailContent";

/**
 * A pinned album's card, docked as a flex sibling between Main and the pinned
 * rail. Closing strips the /album segment (the icon stays in the rail);
 * unpinning hands the presentation back to the centered modal.
 */
export default function DockedAlbumCard({ albumId }: { albumId: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const dispatch = useAppDispatch();

  const handleClose = () => router.push(albumParentPath(pathname));

  return (
    <Sheet
      sx={{
        position: "sticky",
        top: 0,
        height: "100dvh",
        width: "clamp(380px, 30vw, 420px)",
        flexShrink: 0,
        minWidth: 0,
        borderLeft: "1px solid",
        borderColor: "divider",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <Box
        sx={{
          display: "flex",
          justifyContent: "flex-end",
          gap: 0.5,
          p: 1,
          flexShrink: 0,
        }}
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
        <IconButton
          aria-label="Close album details"
          size="sm"
          variant="plain"
          color="neutral"
          onClick={handleClose}
        >
          <Close />
        </IconButton>
      </Box>
      <Divider />
      <Box sx={{ flex: 1, minHeight: 0, overflowY: "auto", p: 2 }}>
        <AlbumDetailContent albumId={albumId} />
      </Box>
    </Sheet>
  );
}
