"use client";

import { AlbumEntry } from "@/lib/features/catalog/types";
import { flowsheetSlice } from "@/lib/features/flowsheet/frontend";
import { Rotation } from "@/lib/features/rotation/types";
import { RotationTrack, useGetRotationQuery, useGetRotationTracksQuery } from "@/lib/features/rotation/api";
import { useAppDispatch } from "@/lib/hooks";
import { useFlowsheetSearch } from "@/src/hooks/flowsheetHooks";
import { Divider } from "@mui/joy";
import { useCallback, useMemo, useState } from "react";
import FlowsheetSearchInput from "./FlowsheetSearchInput";
import RotationBinSelector from "./RotationBinSelector";
import RotationReleaseDropdown from "./RotationReleaseDropdown";
import RotationTrackDropdown from "./RotationTrackDropdown";

export default function RotationEntryFields({ disabled }: { disabled: boolean }) {
  const dispatch = useAppDispatch();
  const { setSearchOpen } = useFlowsheetSearch();

  const [selectedBin, setSelectedBin] = useState<Rotation | null>(null);
  const [selectedRelease, setSelectedRelease] = useState<AlbumEntry | null>(null);
  const [selectedTrack, setSelectedTrack] = useState<RotationTrack | null>(null);
  const [manualEntry, setManualEntry] = useState(false);

  const { data: rotationData } = useGetRotationQuery();

  // Fetch tracks when a release is selected (uses its rotation_id)
  const { data: tracks, isLoading: tracksLoading } = useGetRotationTracksQuery(
    selectedRelease?.rotation_id ?? 0,
    { skip: !selectedRelease?.rotation_id }
  );

  const filteredReleases = useMemo(() => {
    if (!rotationData || !selectedBin) return [];
    return rotationData.filter((r) => r.rotation_bin === selectedBin);
  }, [rotationData, selectedBin]);

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
      setSearchOpen(true);
      dispatch(flowsheetSlice.actions.setSearchProperty({ name: "song", value: "" }));
      dispatch(flowsheetSlice.actions.setSearchProperty({ name: "artist", value: release.artist.name }));
      dispatch(flowsheetSlice.actions.setSearchProperty({ name: "album", value: release.title }));
      dispatch(flowsheetSlice.actions.setSearchProperty({ name: "label", value: release.label }));
      dispatch(
        flowsheetSlice.actions.setRotationMetadata({
          album_id: release.id,
          rotation_id: release.rotation_id,
          rotation_bin: release.rotation_bin,
        })
      );
    },
    [dispatch, setSearchOpen]
  );

  const handleSelectTrack = useCallback(
    (track: RotationTrack) => {
      setSelectedTrack(track);
      setManualEntry(false);
      dispatch(flowsheetSlice.actions.setSearchProperty({ name: "song", value: track.title }));
    },
    [dispatch]
  );

  const handleManualEntry = useCallback(() => {
    setSelectedTrack(null);
    setManualEntry(true);
    dispatch(flowsheetSlice.actions.setSearchProperty({ name: "song", value: "" }));
  }, [dispatch]);

  // Show track dropdown when tracks are available and user hasn't chosen manual entry
  const showTrackDropdown = selectedRelease && !manualEntry && (tracksLoading || (tracks && tracks.length > 0));

  return (
    <>
      <RotationBinSelector
        selectedBin={selectedBin}
        onSelectBin={handleSelectBin}
        disabled={disabled}
      />
      <Divider orientation="vertical" />
      <RotationReleaseDropdown
        releases={filteredReleases}
        selectedRelease={selectedRelease}
        onSelectRelease={handleSelectRelease}
        disabled={disabled || !selectedBin}
      />
      <Divider orientation="vertical" />
      {showTrackDropdown ? (
        <RotationTrackDropdown
          tracks={tracks ?? []}
          isLoading={tracksLoading}
          selectedTrack={selectedTrack}
          onSelectTrack={handleSelectTrack}
          onManualEntry={handleManualEntry}
          disabled={disabled}
        />
      ) : (
        <FlowsheetSearchInput
          name="song"
          disabled={disabled || !selectedRelease}
          required
          suppressHydrationWarning
        />
      )}
    </>
  );
}
