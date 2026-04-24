"use client";

import { usePlaylistSearch } from "@/src/hooks/playlistSearchHooks";
import { Box, Typography } from "@mui/joy";
import PlaylistResultsTable from "./PlaylistResultsTable";
import PlaylistInfiniteScroll from "./PlaylistInfiniteScroll";
import SearchBar from "@/src/components/experiences/modern/previous-sets/Search/SearchBar";

export default function PlaylistSearchContainer() {
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

      {effectiveQuery.length >= 2 && (
        <Box sx={{ mt: 2 }}>
          <Typography level="body-sm" sx={{ mb: 1, color: "text.secondary" }}>
            {isLoading
              ? "Searching..."
              : total > 0
              ? `Found ${total.toLocaleString()} results`
              : "No results found"}
          </Typography>

          {isError && (
            <Typography level="body-sm" color="danger" sx={{ mb: 2 }}>
              An error occurred while searching. Please try again.
            </Typography>
          )}

          {results.length > 0 && (
            <PlaylistInfiniteScroll
              hasMore={hasMore}
              isLoading={isLoading}
              onLoadMore={loadNextPage}
            >
              <PlaylistResultsTable
                results={results}
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
