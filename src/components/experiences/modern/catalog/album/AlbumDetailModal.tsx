"use client";

import { applicationSlice } from "@/lib/features/application/frontend";
import { useGetInformationQuery } from "@/lib/features/catalog/api";
import { AlbumEntry } from "@/lib/features/catalog/types";
import { useAlbumArtwork, useArtistMetadata } from "@/lib/features/metadata/hooks";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { PushPin, PushPinOutlined } from "@mui/icons-material";
import { Box, IconButton, Modal, ModalClose, ModalDialog, Tooltip } from "@mui/joy";
import { useParams, useRouter } from "next/navigation";
import AlbumCard from "./AlbumCard";
import AlbumErrorCard from "./AlbumErrorCard";
import AlbumLoadingCard from "./AlbumLoadingCard";

/**
 * Route-driven album card. Rendered by the `@information` intercepting route
 * (soft navigation) and its hard-navigation fallback, so the open card always
 * has a shareable `/dashboard/album/[id]` URL.
 *
 * `viaHardNavigation` distinguishes the fallback: a pasted permalink has no
 * in-app history entry behind it, so dismissing routes to the catalog instead
 * of `router.back()` (which would leave the app or do nothing).
 */
export default function AlbumDetailModal({
  viaHardNavigation = false,
}: {
  viaHardNavigation?: boolean;
}) {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const albumId = Number(params.id);

  const dispatch = useAppDispatch();
  const pinned = useAppSelector(applicationSlice.selectors.getAlbumCardPinned);

  const { data, isLoading, isError } = useGetInformationQuery(
    { album_id: albumId },
    { skip: !Number.isFinite(albumId) },
  );

  const { artworkUrl, isLoading: metadataLoading, metadata } = useAlbumArtwork(
    data?.artist.name,
    data?.title,
  );

  const { artistMetadata, bioTokens } = useArtistMetadata(metadata?.discogsArtistId);

  const handleClose = () => {
    if (viaHardNavigation) {
      router.push("/dashboard/catalog");
    } else {
      router.back();
    }
  };

  return (
    <Modal
      open
      onClose={handleClose}
      hideBackdrop={pinned}
      disableEnforceFocus={pinned}
      disableAutoFocus={pinned}
      disableEscapeKeyDown={pinned}
      disableScrollLock={pinned}
      // While pinned the page behind stays fully interactive; only the docked
      // card itself may swallow pointer events.
      sx={pinned ? { pointerEvents: "none" } : undefined}
    >
      <ModalDialog
        aria-label="Album details"
        variant="outlined"
        sx={[
          {
            p: 0,
            gap: 0,
            overflow: "hidden",
            pointerEvents: "auto",
          },
          pinned
            ? {
                // Docked at the right edge, full height, over the rightbar.
                top: 0,
                right: 0,
                bottom: 0,
                left: "auto",
                transform: "none",
                height: "100dvh",
                maxHeight: "100dvh",
                width: "min(460px, 100vw)",
                borderRadius: 0,
                borderTop: "none",
                borderRight: "none",
                borderBottom: "none",
              }
            : (theme) => ({
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
              }),
        ]}
      >
        <Tooltip
          variant="outlined"
          size="sm"
          title={pinned ? "Unpin card" : "Pin card to the right"}
        >
          <IconButton
            aria-label={pinned ? "Unpin card" : "Pin card to the right"}
            size="sm"
            variant={pinned ? "soft" : "plain"}
            color="neutral"
            onClick={() => dispatch(applicationSlice.actions.setAlbumCardPinned(!pinned))}
            sx={{
              position: "absolute",
              top: "var(--ModalClose-inset, 8px)",
              right: "calc(var(--ModalClose-inset, 8px) + 36px)",
              zIndex: 2,
            }}
          >
            {pinned ? <PushPin /> : <PushPinOutlined />}
          </IconButton>
        </Tooltip>
        <ModalClose aria-label="Close album details" sx={{ zIndex: 2 }} />
        <Box sx={{ overflowY: "auto", height: "100%" }}>
          {isLoading ? (
            <AlbumLoadingCard />
          ) : isError || !data ? (
            <AlbumErrorCard />
          ) : (
            <AlbumCard
              album={data as AlbumEntry}
              artworkUrl={artworkUrl}
              metadata={metadata}
              metadataLoading={metadataLoading}
              artistBio={artistMetadata?.bio ?? metadata?.artistBio ?? null}
              bioTokens={bioTokens}
              artistWikipediaUrl={artistMetadata?.wikipediaUrl ?? metadata?.artistWikipediaUrl ?? null}
            />
          )}
        </Box>
      </ModalDialog>
    </Modal>
  );
}
