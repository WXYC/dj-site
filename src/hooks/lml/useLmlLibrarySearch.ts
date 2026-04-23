"use client";

import { useEffect, useRef, useState } from "react";
import type { AlbumEntry } from "@/lib/features/catalog/types";
import { getLibrarySearchUrl, getAuthHeaders } from "./lml-client";
import { convertLmlItemToAlbumEntry } from "./lml-conversions";
import type { LmlLibrarySearchResponse } from "./types";

const DEBOUNCE_MS = 350;
const MIN_QUERY_LENGTH = 3;
const RESULT_LIMIT = 10;

/**
 * Debounced hook that searches the library catalog via Backend-Service's
 * proxy endpoint and returns `AlbumEntry[]`.
 * Designed to be called with the current flowsheet search query fields.
 * Gracefully returns an empty array on any error.
 */
export function useLmlLibrarySearch({
  artist,
  album,
}: {
  artist: string;
  album: string;
}): { results: AlbumEntry[]; isLoading: boolean } {
  const [results, setResults] = useState<AlbumEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const combinedLength = artist.length + album.length;
    if (combinedLength < MIN_QUERY_LENGTH) {
      setResults([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    const timer = setTimeout(async () => {
      abortControllerRef.current?.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        const params = new URLSearchParams();
        if (artist) params.set("artist", artist);
        if (album) params.set("title", album);
        params.set("limit", String(RESULT_LIMIT));

        const headers = await getAuthHeaders();
        const response = await fetch(
          `${getLibrarySearchUrl()}?${params}`,
          { signal: controller.signal, headers }
        );

        if (!response.ok) {
          setResults([]);
          setIsLoading(false);
          return;
        }

        const data: LmlLibrarySearchResponse = await response.json();
        setResults(data.results.map(convertLmlItemToAlbumEntry));
      } catch (e) {
        if ((e as Error).name !== "AbortError") {
          setResults([]);
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      abortControllerRef.current?.abort();
    };
  }, [artist, album]);

  return { results, isLoading };
}
