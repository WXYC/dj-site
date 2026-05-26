"use client";

import { useEffect, useState } from "react";
import type { AlbumEntry } from "@/lib/features/catalog/types";
import { isCompilationArtistName } from "@/lib/features/catalog/is-compilation-artist";
import { useSearchLibraryQuery } from "@/lib/features/lml/api";

const DEBOUNCE_MS = 350;
const MIN_QUERY_LENGTH = 3;
const RESULT_LIMIT = 10;

interface DebouncedArgs {
  artist: string;
  album: string;
}

/**
 * Debounced hook that searches the library catalog via Backend-Service's
 * proxy endpoint and returns `AlbumEntry[]`.
 *
 * Thin wrapper around `lmlApi.useSearchLibraryQuery` (RTK Query). Multiple
 * subscribers with the same `{artist, album}` args share one in-flight
 * request and one cache entry — see WXYC/dj-site#563 for the per-subscriber
 * fetch storm this replaces. Auth bearer + `X-Request-Id` and the non-JSON
 * soft-handle for HTML 404s (#519) come from `backendBaseQuery`.
 *
 * Behavior preserved from the previous raw-`fetch` implementation:
 *   - 350 ms debounce on input (including the first emission — `debounced`
 *     starts `null` so RTK Query stays skipped until the timer fires)
 *   - skip until artist.length + album.length >= 3
 *   - empty array on any error response (HTTP 4xx/5xx or network)
 *   - `isLoading` is true from the moment a valid query is typed until the
 *     debounce fires AND the resulting fetch resolves
 */
export function useLmlLibrarySearch({
  artist,
  album,
}: {
  artist: string;
  album: string;
}): { results: AlbumEntry[]; isLoading: boolean } {
  const [debounced, setDebounced] = useState<DebouncedArgs | null>(null);

  useEffect(() => {
    const timer = setTimeout(
      () => setDebounced({ artist, album }),
      DEBOUNCE_MS
    );
    return () => clearTimeout(timer);
  }, [artist, album]);

  const isCompilationQuery = isCompilationArtistName(artist);
  const debouncedIsCompilation = isCompilationArtistName(debounced?.artist);
  const currentLength = artist.length + album.length;
  const hasValidQuery = currentLength >= MIN_QUERY_LENGTH && !isCompilationQuery;
  const debouncedLength = debounced
    ? debounced.artist.length + debounced.album.length
    : 0;
  const skip =
    !debounced || debouncedLength < MIN_QUERY_LENGTH || debouncedIsCompilation;
  const pendingDebounce =
    hasValidQuery &&
    (debounced === null ||
      debounced.artist !== artist ||
      debounced.album !== album);

  const { data, isFetching } = useSearchLibraryQuery(
    debounced
      ? { artist: debounced.artist, title: debounced.album, limit: RESULT_LIMIT }
      : { artist: "", title: "", limit: RESULT_LIMIT },
    { skip }
  );

  return {
    results: skip ? [] : data ?? [],
    isLoading: hasValidQuery && (pendingDebounce || isFetching),
  };
}
