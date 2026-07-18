"use client";

import { applicationSlice } from "@/lib/features/application/frontend";
import { useGetInformationQuery } from "@/lib/features/catalog/api";
import { albumDetailHref } from "@/lib/features/catalog/albumRoutes";
import { genreTone } from "@/lib/features/experiences/modern/tokens/roles";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { Close, SpaceDashboardOutlined } from "@mui/icons-material";
import { Box, Divider, IconButton, Tooltip, Typography } from "@mui/joy";
import { usePathname, useRouter } from "next/navigation";

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

  return (
    <Box
      sx={{
        position: "relative",
        // The unpin badge is reachable but invisible until the tile is
        // hovered or it holds focus.
        "& .unpin-badge": { opacity: 0, transition: "opacity 0.2s" },
        "&:hover .unpin-badge, & .unpin-badge:focus-visible": { opacity: 1 },
      }}
    >
      <Tooltip variant="outlined" size="sm" title={label} placement="left">
        <IconButton
          aria-label={`Open ${label}`}
          onClick={() => router.push(albumDetailHref(pathname, albumId))}
          variant={active ? "soft" : "plain"}
          color={active ? "primary" : "neutral"}
          sx={{ p: "4px", borderRadius: "md" }}
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
        onClick={() => dispatch(applicationSlice.actions.unpinAlbum(albumId))}
        sx={{
          position: "absolute",
          top: -2,
          right: -2,
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
 * The minified rightbar: a narrow strip of "apps". The dashboard app (top)
 * expands the full NowPlaying + Bin rightbar; below it, one icon per pinned
 * album. Rendered only at the dock breakpoint while albums are pinned.
 */
export default function PinnedRail({ activeAlbumId }: { activeAlbumId: number | null }) {
  const dispatch = useAppDispatch();
  const pinnedAlbumIds = useAppSelector(applicationSlice.selectors.getPinnedAlbumIds);

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 1,
        py: 1.5,
      }}
    >
      <Tooltip variant="outlined" size="sm" title="Now Playing & Mail Bin" placement="left">
        <IconButton
          aria-label="Expand the rightbar"
          variant="plain"
          color="neutral"
          onClick={() => dispatch(applicationSlice.actions.setRailExpanded(true))}
          sx={{ "--IconButton-size": "44px" }}
        >
          <SpaceDashboardOutlined />
        </IconButton>
      </Tooltip>
      <Divider sx={{ width: "60%" }} />
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 0.5,
          overflowY: "auto",
          minHeight: 0,
        }}
      >
        {pinnedAlbumIds.map((albumId) => (
          <PinnedAlbumIcon key={albumId} albumId={albumId} active={albumId === activeAlbumId} />
        ))}
      </Box>
    </Box>
  );
}
