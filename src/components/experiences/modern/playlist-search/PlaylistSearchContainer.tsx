"use client";

import {
  MIN_QUERY_LENGTH,
  usePlaylistSearch,
} from "@/src/hooks/playlistSearchHooks";
import type { PlaylistSearchResult } from "@wxyc/shared";
import { Box, Typography } from "@mui/joy";
import PlaylistResultsTable from "./PlaylistResultsTable";
import PlaylistInfiniteScroll from "./PlaylistInfiniteScroll";
import SearchBar from "@/src/components/experiences/modern/previous-sets/Search/SearchBar";

export interface PlaylistSearchContainerProps {
  // Server-rendered "recent playlists" listing for the empty default query.
  // The client infinite query takes over once it resolves.
  initialResults?: PlaylistSearchResult[];
  initialTotal?: number;
}

export default function PlaylistSearchContainer({
  initialResults = [],
  initialTotal = 0,
}: PlaylistSearchContainerProps) {
  const {
    sortBy,
    sortOrder,
    handleSort,
    results,
    total,
    hasMore,
    isLoading,
    isError,
    loadNextPage,
    effectiveQuery,
  } = usePlaylistSearch();

  // The empty query is the canonical "recent playlists" default. Its results
  // are shown just like a real query's — the earlier gate discarded a fetch the
  // hook already fired. A single-character partial still shows nothing (the
  // hook skips it). Until the client query resolves, the server seed backs the
  // default view so the initial HTML carries populated rows.
  const isDefaultQuery = effectiveQuery.length === 0;
  const isRealQuery = effectiveQuery.length >= MIN_QUERY_LENGTH;
  const showResults = isDefaultQuery || isRealQuery;

  const usingSeed = isDefaultQuery && results.length === 0;
  const displayResults = usingSeed ? initialResults : results;
  const displayTotal = usingSeed ? initialTotal : total;

  return (
    <Box sx={{ width: "100%", px: 2 }}>
      <Typography level="h2" sx={{ mb: 2 }}>
        Playlist Archive
      </Typography>
      <Typography level="body-sm" sx={{ mb: 3, color: "text.secondary" }}>
        Search through WXYC playlists from November 2004 to present. Use AND, OR, NOT operators
        and quotes for exact phrases.
      </Typography>

      <SearchBar />

      {showResults && (
        <Box sx={{ mt: 2 }}>
          {isRealQuery && (
            <Typography level="body-sm" sx={{ mb: 1, color: "text.secondary" }}>
              {isLoading
                ? "Searching..."
                : displayTotal > 0
                ? `Found ${displayTotal.toLocaleString()} results`
                : "No results found"}
            </Typography>
          )}

          {isError && isRealQuery && (
            <Typography level="body-sm" color="danger" sx={{ mb: 2 }}>
              An error occurred while searching. Please try again.
            </Typography>
          )}

          {displayResults.length > 0 && (
            <PlaylistInfiniteScroll
              hasMore={hasMore}
              isLoading={isLoading}
              onLoadMore={loadNextPage}
            >
              <PlaylistResultsTable
                results={displayResults}
                sortBy={sortBy}
                sortOrder={sortOrder}
                onSort={handleSort}
              />
            </PlaylistInfiniteScroll>
          )}
        </Box>
      )}
    </Box>
  );
}
