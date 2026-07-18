"use client";

import { applicationSlice } from "@/lib/features/application/frontend";
import { albumParentPath } from "@/lib/features/catalog/albumRoutes";
import { useAppDispatch } from "@/lib/hooks";
import { useMediaQuery } from "@/src/hooks/useMediaQuery";
import { PushPinOutlined } from "@mui/icons-material";
import { Box, IconButton, Modal, ModalClose, ModalDialog, Tooltip } from "@mui/joy";
import { useParams, usePathname, useRouter } from "next/navigation";
import AlbumDetailContent from "./AlbumDetailContent";
import { ALBUM_DOCK_QUERY } from "./dock";

/**
 * Centered album card for an unpinned album URL. Dismissal strips the /album
 * segment from the pathname, which always lands on the page already rendered
 * behind the card — uniform for soft navigation and pasted permalinks alike.
 */
export default function AlbumDetailModal() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams<{ id: string }>();
  const albumId = Number(params.id);

  const dispatch = useAppDispatch();
  const canPin = useMediaQuery(ALBUM_DOCK_QUERY);

  const handleClose = () => router.push(albumParentPath(pathname));

  return (
    <Modal open onClose={handleClose}>
      <ModalDialog
        aria-label="Album details"
        variant="outlined"
        sx={(theme) => ({
          p: 0,
          gap: 0,
          overflow: "hidden",
          width: "min(640px, calc(100vw - 32px))",
          maxHeight: "min(85dvh, 900px)",
          [theme.breakpoints.only("xs")]: {
            inset: 0,
            transform: "none",
            width: "100vw",
            height: "100dvh",
            maxHeight: "100dvh",
            borderRadius: 0,
            border: "none",
          },
        })}
      >
        {canPin && (
          <Tooltip variant="outlined" size="sm" title="Pin card to the rail">
            <IconButton
              aria-label="Pin card to the rail"
              size="sm"
              variant="plain"
              color="neutral"
              onClick={() => dispatch(applicationSlice.actions.pinAlbum(albumId))}
              sx={{
                position: "absolute",
                top: "var(--ModalClose-inset, 8px)",
                right: "calc(var(--ModalClose-inset, 8px) + 36px)",
                zIndex: 2,
              }}
            >
              <PushPinOutlined />
            </IconButton>
          </Tooltip>
        )}
        <ModalClose aria-label="Close album details" sx={{ zIndex: 2 }} />
        <Box sx={{ overflowY: "auto", height: "100%" }}>
          <AlbumDetailContent albumId={albumId} />
        </Box>
      </ModalDialog>
    </Modal>
  );
}
