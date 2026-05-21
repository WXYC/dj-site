"use client";

import { useGetLibraryTracksQuery } from "@/lib/features/metadata/api";
import { LibraryTrack } from "@/lib/features/metadata/types";
import { flowsheetSlice } from "@/lib/features/flowsheet/frontend";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { useMemo } from "react";
import TrackPickerDropdown, { TrackPickerEntry } from "./TrackPickerDropdown";

type PickerTrack = LibraryTrack & TrackPickerEntry;

/**
 * Hook that resolves the picker state for a given library release.
 *
 * `picker.show` is the parent's render gate: true means render
 * `<LibraryTrackPicker>` in place of the free-text song input, false means
 * leave the free-text input alone. The picker collapses back to free-text on
 * three signals — no release selected, query still in flight, and a release
 * with no Discogs-resolvable tracklist (`source: null` or `tracks: []`).
 */
export function useLibraryTrackPicker(albumId: number | null) {
  const { data, isLoading } = useGetLibraryTracksQuery(albumId ?? 0, {
    skip: albumId === null,
  });

  return useMemo(() => {
    if (albumId === null) {
      return { show: false, isLoading: false, tracks: [] as PickerTrack[] };
    }
    if (isLoading) {
      return { show: false, isLoading: true, tracks: [] as PickerTrack[] };
    }
    const tracks: PickerTrack[] = (data?.tracks ?? []).map((t) => ({
      ...t,
      artists: t.artist_credit ? [t.artist_credit] : [],
    }));
    return { show: tracks.length > 0, isLoading: false, tracks };
  }, [albumId, isLoading, data?.tracks]);
}

/**
 * Track picker that surfaces the Discogs tracklist for the release the DJ
 * picked from the search results. On pick: writes both `track_title` (legacy
 * compat) and `track_position` (Discogs `release_track.position`) into Redux
 * so the existing submission path picks them up via
 * `convertQueryToSubmission`.
 *
 * Caller is responsible for the "should we render this at all?" decision via
 * `useLibraryTrackPicker(albumId).show` — when that's false, render the
 * free-text song input instead.
 */
export default function LibraryTrackPicker({
  tracks,
  isLoading,
  disabled,
  onManualEntry,
}: {
  tracks: PickerTrack[];
  isLoading: boolean;
  disabled: boolean;
  onManualEntry: () => void;
}) {
  const dispatch = useAppDispatch();
  const currentPosition = useAppSelector(
    (s) => s.flowsheet.search.query.track_position
  );

  const selectedTrack = useMemo(
    () =>
      currentPosition
        ? tracks.find((t) => t.position === currentPosition) ?? null
        : null,
    [tracks, currentPosition]
  );

  const handleSelect = (track: PickerTrack) => {
    dispatch(
      flowsheetSlice.actions.setSearchProperty({
        name: "song",
        value: track.title,
      })
    );
    dispatch(flowsheetSlice.actions.setTrackPosition(track.position));
  };

  const handleManual = () => {
    dispatch(flowsheetSlice.actions.setTrackPosition(undefined));
    onManualEntry();
  };

  return (
    <TrackPickerDropdown
      tracks={tracks}
      isLoading={isLoading}
      selectedTrack={selectedTrack}
      onSelectTrack={handleSelect}
      onManualEntry={handleManual}
      disabled={disabled}
    />
  );
}
