"use client";

import { usePlaylistSearch } from "@/src/hooks/playlistSearchHooks";
import { Box, Tab, TabList, TabPanel, Tabs, Typography } from "@mui/joy";
import PlaylistAdvancedSearch from "./PlaylistAdvancedSearch";
import PlaylistResultsTable from "./PlaylistResultsTable";
import PlaylistSearchBar from "./PlaylistSearchBar";
import PlaylistInfiniteScroll from "./PlaylistInfiniteScroll";

export default function PlaylistSearchContainer() {
  const {
    mode,
    setMode,
    simpleQuery,
    setSimpleQuery,
    advancedRows,
    addRow,
    removeRow,
    updateRow,
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

      <Tabs
        value={mode === "simple" ? 0 : 1}
        onChange={(_, value) => setMode(value === 0 ? "simple" : "advanced")}
        sx={{ mb: 2 }}
      >
        <TabList>
          <Tab>Simple Search</Tab>
          <Tab>Advanced Search</Tab>
        </TabList>
        <TabPanel value={0} sx={{ p: 0, pt: 2 }}>
          <PlaylistSearchBar
            query={simpleQuery}
            onQueryChange={setSimpleQuery}
            isLoading={isLoading}
          />
        </TabPanel>
        <TabPanel value={1} sx={{ p: 0, pt: 2 }}>
          <PlaylistAdvancedSearch
            rows={advancedRows}
            onAddRow={addRow}
            onRemoveRow={removeRow}
            onUpdateRow={updateRow}
            isLoading={isLoading}
          />
        </TabPanel>
      </Tabs>

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
