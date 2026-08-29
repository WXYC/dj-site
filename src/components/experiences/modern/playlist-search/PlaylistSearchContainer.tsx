"use client";

import { usePlaylistSearchResults } from "@/src/hooks/playlistSearchHooks";
import type { PlaylistSearchResult } from "@wxyc/shared";
import { Box, Typography } from "@mui/joy";
import PlaylistResultsTable from "./PlaylistResultsTable";
import PlaylistInfiniteScroll from "./PlaylistInfiniteScroll";
import SearchBar from "@/src/components/experiences/modern/previous-sets/Search/SearchBar";

export interface PlaylistSearchContainerProps {
  // Server-rendered "recent playlists" listing for the empty default query.
  // The client infinite query takes over once it resolves.
  initialResults?: PlaylistSearchResult[];
}

export default function PlaylistSearchContainer({
  initialResults,
}: PlaylistSearchContainerProps) {
  const {
    sortBy,
    sortOrder,
    handleSort,
    total,
    hasMore,
    isLoading,
    isError,
    loadNextPage,
    displayResults,
    showResults,
    isRealQuery,
  } = usePlaylistSearchResults({ initialResults });

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
                : total > 0
                ? `Found ${total.toLocaleString()} results`
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
