"use client";

import { Box, Chip, CircularProgress, Stack, Typography } from "@mui/joy";
import { useGetLibraryTracksQuery } from "@/lib/features/metadata/api";

/**
 * The tracklist affordance under the promoted selected match: when the match is
 * a linked release, list its tracks so the DJ can pick the exact one. Picking a
 * track sets the song and its Discogs `track_position` on the submission.
 * Renders nothing for unlinked releases or when there's no tracklist.
 */
export default function SelectedMatchTracks({
  albumId,
  currentPosition,
  onPick,
}: {
  albumId: number;
  currentPosition?: string;
  onPick: (title: string, position: string) => void;
}) {
  const { data, isFetching } = useGetLibraryTracksQuery(albumId, {
    skip: albumId <= 0,
    // Don't trust a stale empty cache from a prefetch (mirrors the rotation
    // picker's #589 guard).
    refetchOnMountOrArgChange: true,
  });

  if (albumId <= 0) return null;

  const tracks = data?.tracks ?? [];

  if (isFetching && tracks.length === 0) {
    return (
      <Box sx={{ px: 1, py: 0.5 }}>
        <CircularProgress size="sm" />
      </Box>
    );
  }
  if (tracks.length === 0) return null;

  return (
    <Box data-testid="flowsheet-track-picker" sx={{ px: 1, pt: 0.25, pb: 0.5 }}>
      <Typography
        level="body-xs"
        sx={{
          color: "text.tertiary",
          textTransform: "uppercase",
          letterSpacing: "0.04em",
          fontSize: "0.62rem",
          mb: 0.35,
        }}
      >
        Pick a track
      </Typography>
      <Stack direction="row" flexWrap="wrap" gap={0.5} sx={{ maxHeight: 96, overflowY: "auto" }}>
        {tracks.map((track) => {
          const picked = currentPosition === track.position;
          return (
            <Chip
              key={track.position}
              size="sm"
              variant={picked ? "solid" : "soft"}
              color={picked ? "primary" : "neutral"}
              data-testid={`flowsheet-track-option-${track.position}`}
              onMouseDown={(e) => {
                e.preventDefault(); // keep focus in the composer
                onPick(track.title, track.position);
              }}
              sx={{ cursor: "pointer" }}
            >
              <Box component="span" sx={{ fontFamily: "code", mr: 0.5 }}>
                {track.position}
              </Box>
              {track.title}
            </Chip>
          );
        })}
      </Stack>
    </Box>
  );
}
