"use client";

import { usePlaylistSearch } from "@/src/hooks/playlistSearchHooks";
import PlaylistAdvancedSearch from "@/src/components/experiences/modern/playlist-search/PlaylistAdvancedSearch";
import { Cancel, Troubleshoot, Tune } from "@mui/icons-material";
import { Box, FormControl, FormLabel, IconButton, Input, Tooltip } from "@mui/joy";
import Filters from "./Filters";

export default function SearchBar() {
  const {
    mode,
    setMode,
    simpleQuery,
    setSimpleQuery,
    advancedRows,
    addRow,
    removeRow,
    updateRow,
    isLoading,
  } = usePlaylistSearch();

  const isAdvanced = mode === "advanced";

  return (
    <Box sx={{ py: 2 }}>
      <Box
        sx={{
          borderRadius: "sm",
          display: { xs: "none", sm: "flex" },
          flexWrap: "wrap",
          gap: 1.5,
          "& > *": {
            minWidth: { xs: "180px", md: "200px" },
          },
        }}
      >
        {!isAdvanced && (
          <FormControl
            sx={{ flex: 1, flexBasis: { xs: "100%", lg: "50%" } }}
            size="sm"
          >
            <FormLabel>Search previous sets</FormLabel>
            <Input
              color="primary"
              placeholder="Search"
              startDecorator={<Troubleshoot />}
              endDecorator={
                simpleQuery !== "" ? (
                  <IconButton
                    variant="plain"
                    color="primary"
                    onClick={() => setSimpleQuery("")}
                  >
                    <Cancel />
                  </IconButton>
                ) : undefined
              }
              value={simpleQuery}
              onChange={(e) => setSimpleQuery(e.target.value)}
            />
          </FormControl>
        )}

        {!isAdvanced && <Filters />}

        <FormControl
          size="sm"
          sx={{ flex: "none", justifyContent: "flex-end" }}
        >
          <Tooltip
            title={isAdvanced ? "Simple Search" : "Advanced Search"}
            placement="top"
            size="sm"
          >
            <IconButton
              variant={isAdvanced ? "solid" : "outlined"}
              color="primary"
              onClick={() => setMode(isAdvanced ? "simple" : "advanced")}
            >
              <Tune />
            </IconButton>
          </Tooltip>
        </FormControl>
      </Box>

      {isAdvanced && (
        <Box sx={{ mt: 2 }}>
          <PlaylistAdvancedSearch
            rows={advancedRows}
            onAddRow={addRow}
            onRemoveRow={removeRow}
            onUpdateRow={updateRow}
            isLoading={isLoading}
          />
        </Box>
      )}
    </Box>
  );
}
