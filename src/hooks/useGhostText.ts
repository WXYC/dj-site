"use client";

import {
  useSuggestArtistsQuery,
  useSuggestTracksQuery,
} from "@/lib/features/flowsheet/api";
import { isCompilationArtistName } from "@/lib/features/catalog/is-compilation-artist";
import { SuggestTrackResult } from "@/lib/features/flowsheet/types";
import { useMemo } from "react";
import { useDebouncedValue } from "./useDebouncedValue";

const DEBOUNCE_MS = 200;
const MIN_PREFIX_LENGTH = 2;

export type GhostTextField = "artist" | "song" | "album";

export type GhostTextResult = {
  /** The untyped suffix to display as grey ghost text (e.g., "techre" when user typed "Au") */
  ghostSuffix: string;
  /** Accept the ghost text. Returns the full canonical suggestion, or null if nothing to accept. */
  acceptGhostText: () => string | null;
  /** The full track result (for song field), including album_title and record_label for auto-fill */
  trackResult: SuggestTrackResult | null;
};

/**
 * Provides ghost text autocomplete for the artist, song, or album field.
 *
 * - `artist`: suggests from the library catalog (`suggestArtists`).
 * - `song`: suggests from flowsheet history, filtered by `confirmedArtist`.
 * - `album`: has no suggest endpoint — pass `suggestionOverride` (e.g. the top
 *   catalog result's title) to drive it through the same prefix-verify path.
 *
 * `suggestionOverride`, when provided for any field, wins over the internal
 * queries (used for album, and available as an escape hatch).
 */
export function useGhostText(
  field: GhostTextField,
  currentValue: string,
  confirmedArtist?: string,
  suggestionOverride?: string
): GhostTextResult {
  const debouncedValue = useDebouncedValue(currentValue, DEBOUNCE_MS);
  const shouldQuery = debouncedValue.length >= MIN_PREFIX_LENGTH;
  const skipForCompilation =
    field === "artist" && isCompilationArtistName(debouncedValue);

  const artistQuery = useSuggestArtistsQuery(
    { q: debouncedValue, limit: 1 },
    {
      skip:
        field !== "artist" ||
        !shouldQuery ||
        skipForCompilation ||
        Boolean(suggestionOverride),
    }
  );

  const trackQuery = useSuggestTracksQuery(
    { q: debouncedValue, artist: confirmedArtist || "", limit: 1 },
    {
      skip:
        field !== "song" ||
        !shouldQuery ||
        !confirmedArtist ||
        Boolean(suggestionOverride),
    }
  );

  return useMemo(() => {
    let suggestion: string | null = null;
    let trackResult: SuggestTrackResult | null = null;

    if (suggestionOverride) {
      suggestion = suggestionOverride;
    } else if (field === "artist" && artistQuery.data?.length) {
      suggestion = artistQuery.data[0];
    } else if (field === "song" && trackQuery.data?.length) {
      trackResult = trackQuery.data[0];
      suggestion = trackResult.track_title;
    }

    if (
      !suggestion ||
      !currentValue ||
      !suggestion.toLowerCase().startsWith(currentValue.toLowerCase()) ||
      suggestion.length <= currentValue.length
    ) {
      return {
        ghostSuffix: "",
        acceptGhostText: () => null,
        trackResult: null,
      };
    }

    const ghostSuffix = suggestion.slice(currentValue.length);

    return {
      ghostSuffix,
      acceptGhostText: () => suggestion,
      trackResult,
    };
  }, [
    field,
    currentValue,
    suggestionOverride,
    artistQuery.data,
    trackQuery.data,
  ]);
}
