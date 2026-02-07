"use client";

import type { SearchRow } from "@/lib/features/playlist-search/frontend";
import { Box, Button, CircularProgress, Stack, Typography } from "@mui/joy";
import PlaylistSearchRow from "./PlaylistSearchRow";

interface PlaylistAdvancedSearchProps {
  rows: SearchRow[];
  onAddRow: () => void;
  onRemoveRow: (id: string) => void;
  onUpdateRow: (id: string, updates: Partial<SearchRow>) => void;
  isLoading: boolean;
}

export default function PlaylistAdvancedSearch({
  rows,
  onAddRow,
  onRemoveRow,
  onUpdateRow,
  isLoading,
}: PlaylistAdvancedSearchProps) {
  return (
    <Box
      sx={{
        p: 2,
        border: "1px solid",
        borderColor: "divider",
        borderRadius: "sm",
        bgcolor: "background.surface",
      }}
    >
      <Typography level="body-sm" sx={{ mb: 2, color: "text.secondary" }}>
        Build your search query by adding conditions. Combine with AND, OR, NOT operators.
      </Typography>

      <Stack spacing={2}>
        {rows.map((row, index) => (
          <PlaylistSearchRow
            key={row.id}
            row={row}
            isFirst={index === 0}
            canRemove={rows.length > 1}
            onUpdate={(updates) => onUpdateRow(row.id, updates)}
            onAdd={onAddRow}
            onRemove={() => onRemoveRow(row.id)}
          />
        ))}
      </Stack>

      <Box sx={{ mt: 2, display: "flex", alignItems: "center", gap: 2 }}>
        <Button
          variant="solid"
          color="primary"
          disabled={isLoading || rows.every((r) => !r.value.trim())}
          startDecorator={isLoading ? <CircularProgress size="sm" /> : null}
        >
          {isLoading ? "Searching..." : "Search"}
        </Button>
        <Typography level="body-xs" sx={{ color: "text.tertiary" }}>
          Results update automatically as you type
        </Typography>
      </Box>
    </Box>
  );
}
