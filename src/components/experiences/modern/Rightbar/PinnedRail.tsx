"use client";

import { applicationSlice } from "@/lib/features/application/frontend";
import { useGetInformationQuery } from "@/lib/features/catalog/api";
import {
  albumParentPath,
  parseAlbumIdFromPathname,
} from "@/lib/features/catalog/albumRoutes";
import useOpenAlbumDetail from "../catalog/album/useOpenAlbumDetail";
import { genreTone } from "@/lib/features/experiences/modern/tokens/roles";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { Close, SpaceDashboardOutlined } from "@mui/icons-material";
import { Box, Divider, IconButton, Tooltip, Typography } from "@mui/joy";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  DOCK_HEADER_HEIGHT,
  RIGHTBAR_FOOTER_CLEARANCE,
} from "../catalog/album/dock";

function PinnedAlbumIcon({ albumId, active }: { albumId: number; active: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const dispatch = useAppDispatch();

  const { data } = useGetInformationQuery({ album_id: albumId });

  const artistDisplay = data
    ? data.album_artist
      ? "Various Artists"
      : data.artist.name
    : null;
  const label = data ? `${artistDisplay} – ${data.title}` : "Pinned album";
  const genreColor = genreTone(data?.artist.genre).color;

  const openAlbumDetail = useOpenAlbumDetail();
  const openAlbum = () => openAlbumDetail(albumId);

  // Unpinning from the rail discards the card entirely — never a modal
  // handoff (that is the docked header's unpin) — and leaves the dock's
  // collapse state alone, except that unpinning the pane in view yields to
  // home. When the album's URL is open, the unpin must wait for the
  // navigation away: unpinning first would let the route child flash the
  // modal until the pathname lands.
  const [unpinPending, setUnpinPending] = useState(false);

  useEffect(() => {
    if (!unpinPending || parseAlbumIdFromPathname(pathname) === albumId) {
      return;
    }
    dispatch(applicationSlice.actions.unpinAlbum(albumId));
    setUnpinPending(false);
  }, [unpinPending, pathname, albumId, dispatch]);

  const unpin = () => {
    if (active) {
      dispatch(applicationSlice.actions.setDockView("home"));
    }
    if (parseAlbumIdFromPathname(pathname) === albumId) {
      setUnpinPending(true);
      router.push(albumParentPath(pathname));
    } else {
      dispatch(applicationSlice.actions.unpinAlbum(albumId));
    }
  };

  return (
    <Box
      sx={{
        position: "relative",
        "& .unpin-badge": { opacity: 0, transition: "opacity 0.2s" },
        "&:hover .unpin-badge, & .unpin-badge:focus-visible": { opacity: 1 },
      }}
    >
      <Tooltip variant="outlined" size="sm" title={label} placement="left">
        <IconButton
          aria-label={`Open ${label}`}
          onClick={openAlbum}
          variant={active ? "soft" : "plain"}
          color={active ? "primary" : "neutral"}
          sx={{ p: "4px", borderRadius: "md", "--IconButton-size": "52px" }}
        >
          {data?.artwork_url ? (
            <Box
              component="img"
              src={data.artwork_url}
              alt=""
              sx={{
                width: 44,
                height: 44,
                borderRadius: "sm",
                objectFit: "cover",
                outline: active ? "2px solid" : "none",
                outlineColor: "primary.500",
              }}
            />
          ) : (
            <Box
              aria-hidden
              sx={{
                width: 44,
                height: 44,
                borderRadius: "sm",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                outline: active ? "2px solid" : "none",
                outlineColor: "primary.500",
                background: (theme) =>
                  `linear-gradient(135deg, ${theme.vars.palette[genreColor][400]}, ${theme.vars.palette[genreColor][700]})`,
              }}
            >
              <Typography
                level="title-sm"
                sx={{ color: "#fff", opacity: 0.9, fontWeight: 700, letterSpacing: "0.08em" }}
              >
                {data?.artist.lettercode ?? "♪"}
              </Typography>
            </Box>
          )}
        </IconButton>
      </Tooltip>
      <IconButton
        className="unpin-badge"
        aria-label={`Unpin ${label}`}
        size="sm"
        variant="solid"
        color="neutral"
        onClick={unpin}
        sx={{
          position: "absolute",
          top: 0,
          right: 0,
          zIndex: 1,
          "--IconButton-size": "18px",
          "--Icon-fontSize": "12px",
          borderRadius: "50%",
        }}
      >
        <Close />
      </IconButton>
    </Box>
  );
}

/**
 * The persistent strip at the far right while albums are pinned. The dashboard
 * app (top) toggles the home panel (NowPlaying + Bin) in the docked slot;
 * below it, one icon per pinned album swaps the slot to that album's card.
 */
export default function PinnedRail({ activeAlbumId }: { activeAlbumId: number | null }) {
  const dispatch = useAppDispatch();
  const pinnedAlbumIds = useAppSelector(applicationSlice.selectors.getPinnedAlbumIds);
  const homeOpen = useAppSelector(applicationSlice.selectors.getDockView) === "home";

  return (
    <Box
      sx={{
        flex: 1,
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <Box
        sx={{
          height: DOCK_HEADER_HEIGHT,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <Tooltip variant="outlined" size="sm" title="Now Playing & Mail Bin" placement="left">
          <IconButton
            aria-label={homeOpen ? "Collapse the dashboard panel" : "Expand the dashboard panel"}
            variant={homeOpen ? "soft" : "plain"}
            color={homeOpen ? "primary" : "neutral"}
            onClick={() =>
              dispatch(applicationSlice.actions.setDockView(homeOpen ? "collapsed" : "home"))
            }
            sx={{ "--IconButton-size": "44px" }}
          >
            <SpaceDashboardOutlined />
          </IconButton>
        </Tooltip>
      </Box>
      <Divider />
      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          overflowX: "hidden",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 0.5,
          py: 1,
        }}
      >
        {pinnedAlbumIds.map((albumId) => (
          <PinnedAlbumIcon key={albumId} albumId={albumId} active={albumId === activeAlbumId} />
        ))}
      </Box>
      <Box sx={{ minHeight: `${RIGHTBAR_FOOTER_CLEARANCE}px`, flexShrink: 0 }} />
    </Box>
  );
}
