"use client";

import { AlbumEntry } from "@/lib/features/catalog/types";
import { flowsheetSlice } from "@/lib/features/flowsheet/frontend";
import { Rotation } from "@/lib/features/rotation/types";
import { normalizeTrackArtists } from "@/lib/features/rotation/normalize-track-artists";
import {
  RotationTrack,
  useGetRotationQuery,
  useGetRotationTracksQuery,
} from "@/lib/features/rotation/api";
import { useAppDispatch } from "@/lib/hooks";
import { Box, Chip, Divider, Stack, Typography } from "@mui/joy";
import { useCallback, useMemo, useState } from "react";
import TrackPickerDropdown from "./TrackPickerDropdown";

export default function RotationBrowse({ disabled }: { disabled?: boolean }) {
  const dispatch = useAppDispatch();
  const [selectedBin, setSelectedBin] = useState<Rotation | null>(null);
  const [selectedRelease, setSelectedRelease] = useState<AlbumEntry | null>(null);
  const [selectedTrack, setSelectedTrack] = useState<RotationTrack | null>(null);
  const [manualEntry, setManualEntry] = useState(false);

  const { data: rotationData } = useGetRotationQuery();

  const { data: tracks, isFetching: tracksLoading } = useGetRotationTracksQuery(
    selectedRelease?.rotation_id ?? 0,
    { skip: !selectedRelease?.rotation_id, refetchOnMountOrArgChange: true }
  );

  const filteredReleases = useMemo(() => {
    if (!rotationData || !selectedBin) return [];
    return rotationData.filter((r) => r.rotation_bin === selectedBin);
  }, [rotationData, selectedBin]);

  const bins = useMemo(() => {
    if (!rotationData) return [];
    return [...new Set(rotationData.map((r) => r.rotation_bin).filter(Boolean))] as Rotation[];
  }, [rotationData]);

  const handleSelectBin = useCallback(
    (bin: Rotation) => {
      setSelectedBin(bin);
      setSelectedRelease(null);
      setSelectedTrack(null);
      setManualEntry(false);
      dispatch(flowsheetSlice.actions.setSearchProperty({ name: "song", value: "" }));
      dispatch(flowsheetSlice.actions.setSearchProperty({ name: "artist", value: "" }));
      dispatch(flowsheetSlice.actions.setSearchProperty({ name: "album", value: "" }));
      dispatch(flowsheetSlice.actions.setSearchProperty({ name: "label", value: "" }));
      dispatch(
        flowsheetSlice.actions.setRotationMetadata({
          album_id: undefined,
          rotation_id: undefined,
          rotation_bin: bin,
        })
      );
    },
    [dispatch]
  );

  const handleSelectRelease = useCallback(
    (release: AlbumEntry) => {
      setSelectedRelease(release);
      setSelectedTrack(null);
      setManualEntry(false);
      dispatch(flowsheetSlice.actions.setSearchProperty({ name: "song", value: "" }));
      dispatch(
        flowsheetSlice.actions.setSearchProperty({
          name: "artist",
          value: release.artist?.name ?? "",
        })
      );
      dispatch(
        flowsheetSlice.actions.setSearchProperty({
          name: "album",
          value: release.title,
        })
      );
      dispatch(
        flowsheetSlice.actions.setSearchProperty({
          name: "label",
          value: release.label,
        })
      );
      dispatch(
        flowsheetSlice.actions.setRotationMetadata({
          album_id: release.id,
          rotation_id: release.rotation_id,
          rotation_bin: release.rotation_bin,
        })
      );
    },
    [dispatch]
  );

  const handleSelectTrack = useCallback(
    (track: RotationTrack) => {
      setSelectedTrack(track);
      setManualEntry(false);
      dispatch(
        flowsheetSlice.actions.setSearchProperty({
          name: "song",
          value: track.title ?? "",
        })
      );
      const credits = normalizeTrackArtists(track.artists);
      if (credits.length > 0) {
        dispatch(
          flowsheetSlice.actions.setSearchProperty({
            name: "artist",
            value: credits.join(", "),
          })
        );
      }
    },
    [dispatch]
  );

  const handleManualEntry = useCallback(() => {
    setSelectedTrack(null);
    setManualEntry(true);
    dispatch(flowsheetSlice.actions.setSearchProperty({ name: "song", value: "" }));
  }, [dispatch]);

  const showTrackDropdown =
    selectedRelease &&
    !manualEntry &&
    (tracksLoading || (tracks && tracks.length > 0));

  return (
    <Box data-testid="rotation-browse" sx={{ p: 1 }}>
      <Stack direction="row" spacing={0.5} flexWrap="wrap" sx={{ mb: 1 }}>
        {bins.map((bin) => (
          <Chip
            key={bin}
            size="sm"
            variant={selectedBin === bin ? "solid" : "outlined"}
            onClick={() => !disabled && handleSelectBin(bin)}
            data-testid={`rotation-bin-${bin}`}
          >
            {bin}
          </Chip>
        ))}
      </Stack>
      {selectedBin && (
        <>
          <Divider sx={{ my: 0.5 }} />
          <Stack spacing={0.25}>
            {filteredReleases.map((release) => (
              <Box
                key={release.id}
                onClick={() => !disabled && handleSelectRelease(release)}
                data-testid={`rotation-release-${release.id}`}
                sx={{
                  p: 0.75,
                  borderRadius: "sm",
                  cursor: disabled ? "default" : "pointer",
                  bgcolor:
                    selectedRelease?.id === release.id
                      ? "primary.softBg"
                      : "transparent",
                  "&:hover": disabled
                    ? undefined
                    : { bgcolor: "background.level1" },
                }}
              >
                <Typography level="body-sm">
                  {release.artist?.name} — {release.title}
                </Typography>
                <Typography level="body-xs" sx={{ color: "text.tertiary" }}>
                  {release.label}
                </Typography>
              </Box>
            ))}
          </Stack>
        </>
      )}
      {showTrackDropdown && (
        <>
          <Divider sx={{ my: 0.5 }} />
          <TrackPickerDropdown
            tracks={tracks ?? []}
            isLoading={tracksLoading}
            selectedTrack={selectedTrack}
            onSelectTrack={handleSelectTrack}
            onManualEntry={handleManualEntry}
            disabled={disabled}
          />
        </>
      )}
    </Box>
  );
}
