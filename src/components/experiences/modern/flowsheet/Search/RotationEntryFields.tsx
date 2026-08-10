"use client";

import { isCompilationRelease } from "@/lib/features/catalog/is-compilation-artist";
import { AlbumEntry } from "@/lib/features/catalog/types";
import { flowsheetSlice } from "@/lib/features/flowsheet/frontend";
import {
  releaseCreditIsRefused,
  seedableArtistName,
} from "@/lib/features/flowsheet/various-artists-guard";
import { Rotation } from "@/lib/features/rotation/types";
import { normalizeTrackArtists } from "@/lib/features/rotation/normalize-track-artists";
import {
  RotationTrack,
  useGetRotationQuery,
  useGetRotationTracksQuery,
} from "@/lib/features/rotation/api";
import { useAppDispatch, useAppSelector, useAppStore } from "@/lib/hooks";
import { Box } from "@mui/joy";
import { useCallback, useMemo, useState } from "react";
import FlowsheetSearchInput from "./FlowsheetSearchInput";
import RotationBinSelector from "./RotationBinSelector";
import RotationReleaseDropdown from "./RotationReleaseDropdown";
import TrackPickerDropdown from "./TrackPickerDropdown";

export default function RotationEntryFields({ disabled }: { disabled: boolean }) {
  const dispatch = useAppDispatch();
  const store = useAppStore();
  const songValue = useAppSelector(
    (state) => flowsheetSlice.selectors.getSearchQuery(state).song as string
  );
  const artistValue = useAppSelector(
    (state) => flowsheetSlice.selectors.getSearchQuery(state).artist as string
  );
  const labelValue = useAppSelector(
    (state) => flowsheetSlice.selectors.getSearchQuery(state).label as string
  );

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
      dispatch(flowsheetSlice.actions.setSearchOpen(true));
      dispatch(flowsheetSlice.actions.setSearchProperty({ name: "song", value: "" }));
      dispatch(flowsheetSlice.actions.setSearchProperty({ name: "artist", value: seedableArtistName(release) }));
      dispatch(flowsheetSlice.actions.setSearchProperty({ name: "album", value: release.title }));
      dispatch(flowsheetSlice.actions.setSearchProperty({ name: "label", value: release.label ?? "" }));
      dispatch(
        flowsheetSlice.actions.setRotationMetadata({
          // Withheld when the credit is refused: BS's album_id branch spreads
          // the library row's artist_name over the request's, so keeping the
          // linkage would hand back the very credit the DJ just replaced.
          // Classic makes the same trade by switching submission variants.
          album_id: releaseCreditIsRefused(release) ? undefined : release.id,
          rotation_id: release.rotation_id,
          rotation_bin: release.rotation_bin,
        })
      );
    },
    [dispatch]
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

  // Distinct from the above on purpose — see releaseCreditIsRefused.
  const needsPerformerName =
    !!selectedRelease && releaseCreditIsRefused(selectedRelease);

  const handleSelectTrack = useCallback(
    (track: RotationTrack) => {
      setSelectedTrack(track);
      setManualEntry(false);
      dispatch(flowsheetSlice.actions.setSearchProperty({ name: "song", value: track.title ?? "" }));
      if (!trackCreditsAreDisambiguating) return;
      // `normalizeTrackArtists` strips the Discogs `(N)` disambig and dedupes
      // — see its header for the LML cache duplication root cause. Join
      // separator mirrors buildArtistCredit in apps/backend/controllers/proxy.controller.ts.
      const credits = normalizeTrackArtists(track.artists);
      if (credits.length > 0) {
        dispatch(
          flowsheetSlice.actions.setSearchProperty({
            name: "artist",
            value: credits.join(", "),
          })
        );
        return;
      }
      // No usable per-track credits: fall back to the release-level artist,
      // dispatching only when it differs from the live value so re-selecting a
      // release does not re-write it. On a V/A comp that fallback is empty
      // rather than the compilation credit — clearing still prevents the
      // previous track's performer from lingering, which is the point.
      const releaseArtist = seedableArtistName(selectedRelease);
      const currentArtist = flowsheetSlice.selectors.getSearchQuery(
        store.getState()
      ).artist;
      if (currentArtist !== releaseArtist) {
        dispatch(
          flowsheetSlice.actions.setSearchProperty({
            name: "artist",
            value: releaseArtist,
          })
        );
      }
    },
    [dispatch, store, trackCreditsAreDisambiguating, selectedRelease]
  );

  const handleManualEntry = useCallback(() => {
    setSelectedTrack(null);
    setManualEntry(true);
    dispatch(flowsheetSlice.actions.setSearchProperty({ name: "song", value: "" }));
  }, [dispatch]);

  const showTrackDropdown = selectedRelease && !manualEntry && (tracksLoading || (tracks && tracks.length > 0));

  return (
    <>
      <RotationBinSelector
        selectedBin={selectedBin}
        onSelectBin={handleSelectBin}
        disabled={disabled}
      />
      <Box
        className="entry-field-cell"
        sx={{ display: "flex", alignItems: "center", minWidth: 0, flex: 1 }}
      >
        <RotationReleaseDropdown
          releases={filteredReleases}
          selectedRelease={selectedRelease}
          onSelectRelease={handleSelectRelease}
          disabled={disabled || !selectedBin}
        />
      </Box>
      <Box
        className="entry-field-cell"
        sx={{ display: "flex", alignItems: "center", minWidth: 0, flex: 1 }}
      >
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
            value={songValue}
            disabled={disabled || !selectedRelease}
            required
            suppressHydrationWarning
          />
        )}
      </Box>
      {/* Shown exactly when the release cannot supply its own artist, so the
          submit guard always has a field that can satisfy it. Releases whose
          credit is a real name keep the read-only behavior — including
          compilations filed under a credited album artist. */}
      {needsPerformerName && (
        <FlowsheetSearchInput
          name="artist"
          value={artistValue}
          disabled={disabled}
          required
          suppressHydrationWarning
        />
      )}
      {/* Editable label: some rotation albums carry no label upstream and the
          DJ is the only source for it */}
      <FlowsheetSearchInput
        name="label"
        value={labelValue}
        disabled={disabled || !selectedRelease}
        suppressHydrationWarning
      />
    </>
  );
}
