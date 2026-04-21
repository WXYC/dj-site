"use client";

import {
  useSuggestArtistsQuery,
  useSuggestTracksQuery,
} from "@/lib/features/flowsheet/api";
import { SuggestTrackResult } from "@/lib/features/flowsheet/types";
import { useMemo } from "react";
import { useDebouncedValue } from "./useDebouncedValue";

const DEBOUNCE_MS = 150;
const MIN_PREFIX_LENGTH = 2;

export type GhostTextResult = {
  /** The untyped suffix to display as grey ghost text (e.g., "techre" when user typed "Au") */
  ghostSuffix: string;
  /** Accept the ghost text. Returns the full canonical suggestion, or null if nothing to accept. */
  acceptGhostText: () => string | null;
  /** The full track result (for song field), including album_title and record_label for auto-fill */
  trackResult: SuggestTrackResult | null;
};

/**
 * Provides ghost text autocomplete for artist or song fields.
 *
 * For `artist`: suggests from the library catalog.
 * For `song`: suggests from flowsheet history, filtered by confirmedArtist.
 */
export function useGhostText(
  field: "artist" | "song",
  currentValue: string,
  confirmedArtist?: string
): GhostTextResult {
  const debouncedValue = useDebouncedValue(currentValue, DEBOUNCE_MS);
  const shouldQuery = debouncedValue.length >= MIN_PREFIX_LENGTH;

  const artistQuery = useSuggestArtistsQuery(
    { q: debouncedValue, limit: 1 },
    { skip: field !== "artist" || !shouldQuery }
  );

  const trackQuery = useSuggestTracksQuery(
    { q: debouncedValue, artist: confirmedArtist || "", limit: 1 },
    { skip: field !== "song" || !shouldQuery || !confirmedArtist }
  );

  return useMemo(() => {
    let suggestion: string | null = null;
    let trackResult: SuggestTrackResult | null = null;

    if (field === "artist" && artistQuery.data?.length) {
      suggestion = artistQuery.data[0];
    } else if (field === "song" && trackQuery.data?.length) {
      trackResult = trackQuery.data[0];
      suggestion = trackResult.track_title;
    }

    // Verify the suggestion starts with what the user typed (case-insensitive)
    if (
      !suggestion ||
      !currentValue ||
      !suggestion.toLowerCase().startsWith(currentValue.toLowerCase())
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
  }, [field, currentValue, artistQuery.data, trackQuery.data]);
}
