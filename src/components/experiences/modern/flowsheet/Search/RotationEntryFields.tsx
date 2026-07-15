"use client";

import { isCompilationRelease } from "@/lib/features/catalog/is-compilation-artist";
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
import { useFlowsheetSearch } from "@/src/hooks/flowsheetHooks";
import { Divider } from "@mui/joy";
import { useCallback, useMemo, useState } from "react";
import FlowsheetSearchInput from "./FlowsheetSearchInput";
import RotationBinSelector from "./RotationBinSelector";
import RotationReleaseDropdown from "./RotationReleaseDropdown";
import TrackPickerDropdown from "./TrackPickerDropdown";

export default function RotationEntryFields({ disabled }: { disabled: boolean }) {
  const dispatch = useAppDispatch();
  const { setSearchOpen } = useFlowsheetSearch();

  const [selectedBin, setSelectedBin] = useState<Rotation | null>(null);
  const [selectedRelease, setSelectedRelease] = useState<AlbumEntry | null>(null);
  const [selectedTrack, setSelectedTrack] = useState<RotationTrack | null>(null);
  const [manualEntry, setManualEntry] = useState(false);

  const { data: rotationData } = useGetRotationQuery();

  // `refetchOnMountOrArgChange` forces a re-query on every release pick
  // rather than trusting the RTK Query cache: the cache may hold `200 + []`
  // from a swallowed LML timeout (BS `resolveRotationDiscogsReleaseViaLml`
  // returns null on AbortError → controller emits `[]`), and without the
  // forced refetch the picker silently falls through to the free-text input
  // (WXYC/dj-site#589). Reading `isFetching` rather than `isLoading` keeps
  // the dropdown visible during refetches over that stale-empty cache.
  const { data: tracks, isFetching: tracksLoading } = useGetRotationTracksQuery(
    selectedRelease?.rotation_id ?? 0,
    { skip: !selectedRelease?.rotation_id, refetchOnMountOrArgChange: true }
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
      dispatch(flowsheetSlice.actions.setSearchProperty({ name: "artist", value: release.artist?.name ?? "" }));
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

  // Discogs per-track `artists` carries contributor credits (producer,
  // co-writer, sample) on normal releases, not just performers — BS's
  // `projectInlineTracklist` forwards them raw. Only compilations and V/A
  // releases can trust them as the performing artist; on anything else the
  // auto-fill silently corrupted the flowsheet write (#763, the Saint
  // Etienne / Foxbase Alpha report). Known gap until BS exposes a
  // compilation/split hint on RotationTrack: splits filed under a band
  // name keep the release-level artist.
  const trackCreditsAreDisambiguating =
    !!selectedRelease && isCompilationRelease(selectedRelease);

  const handleSelectTrack = useCallback(
    (track: RotationTrack) => {
      setSelectedTrack(track);
      setManualEntry(false);
      dispatch(flowsheetSlice.actions.setSearchProperty({ name: "song", value: track.title ?? "" }));
      if (!trackCreditsAreDisambiguating) return;
      // `normalizeTrackArtists` strips the Discogs `(N)` disambig and dedupes
      // — see its header for the LML cache duplication root cause. When
      // credits are empty (Discogs has no per-track data, or every entry was
      // malformed) leave the release-level artist in place. Join separator
      // mirrors buildArtistCredit in apps/backend/controllers/proxy.controller.ts.
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
    [dispatch, trackCreditsAreDisambiguating]
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
        <TrackPickerDropdown
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
