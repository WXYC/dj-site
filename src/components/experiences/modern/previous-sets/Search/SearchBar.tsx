"use client";

import type { SearchField } from "@/lib/features/playlist-search/frontend";
import { usePlaylistSearch } from "@/src/hooks/playlistSearchHooks";
import { Add, Cancel, Remove, Troubleshoot } from "@mui/icons-material";
import { Box, IconButton, Input, Option, Select, Stack } from "@mui/joy";
import SortBySelect from "./SortBySelect";

const SEARCH_FIELD_OPTIONS: { value: SearchField; label: string }[] = [
  { value: "all", label: "All" },
  { value: "artist", label: "Artist" },
  { value: "song", label: "Song" },
  { value: "album", label: "Album" },
  { value: "label", label: "Label" },
  { value: "dj", label: "DJ" },
  { value: "date", label: "Date" },
  { value: "dateRange", label: "Date Range" },
];

const OPERATOR_OPTIONS = [
  { value: "AND" as const, label: "AND" },
  { value: "OR" as const, label: "OR" },
  { value: "NOT" as const, label: "NOT" },
];

export default function SearchBar() {
  const { rows, addRow, removeRow, updateRow } = usePlaylistSearch();

  return (
    <Box sx={{ py: 2, display: { xs: "none", sm: "block" } }}>
      <Stack spacing={1}>
        {rows.map((row, index) => {
          const isFirst = index === 0;
          const isDateField = row.field === "date";
          const isDateRangeField = row.field === "dateRange";

          return (
            <Stack
              key={row.id}
              direction="row"
              spacing={1}
              sx={{ alignItems: "center" }}
            >
              {/* Operator dropdown (subsequent rows only) */}
              {!isFirst && (
                <Select
                  value={row.operator}
                  onChange={(_, value) =>
                    value && updateRow(row.id, { operator: value })
                  }
                  size="sm"
                  color="primary"
                  sx={{ minWidth: 80, flexShrink: 0 }}
                >
                  {OPERATOR_OPTIONS.map((opt) => (
                    <Option key={opt.value} value={opt.value}>
                      {opt.label}
                    </Option>
                  ))}
                </Select>
              )}

              {/* Sort By dropdown (first row only, before field dropdown) */}
              {isFirst && <SortBySelect />}

              {/* Search field dropdown */}
              <Select
                value={row.field}
                onChange={(_, value) =>
                  value &&
                  updateRow(row.id, {
                    field: value,
                    value: "",
                    valueTo: undefined,
                  })
                }
                size="sm"
                color="primary"
                slotProps={{ button: { sx: { whiteSpace: "nowrap" } } }}
                sx={{ minWidth: 100, flexShrink: 0 }}
              >
                {SEARCH_FIELD_OPTIONS.map((opt) => (
                  <Option key={opt.value} value={opt.value}>
                    {opt.label}
                  </Option>
                ))}
              </Select>

              {/* Input field(s) */}
              {isDateField ? (
                <Input
                  type="date"
                  value={row.value}
                  onChange={(e) => updateRow(row.id, { value: e.target.value })}
                  size="sm"
                  color="primary"
                  sx={{ flex: 1, minWidth: 150 }}
                />
              ) : isDateRangeField ? (
                <>
                  <Input
                    type="date"
                    value={row.value}
                    onChange={(e) =>
                      updateRow(row.id, { value: e.target.value })
                    }
                    size="sm"
                    color="primary"
                    sx={{ flex: 1, minWidth: 140 }}
                    placeholder="From"
                  />
                  <Input
                    type="date"
                    value={row.valueTo || ""}
                    onChange={(e) =>
                      updateRow(row.id, { valueTo: e.target.value })
                    }
                    size="sm"
                    color="primary"
                    sx={{ flex: 1, minWidth: 140 }}
                    placeholder="To"
                  />
                </>
              ) : (
                <Input
                  color="primary"
                  placeholder="Search previous sets"
                  startDecorator={isFirst ? <Troubleshoot /> : undefined}
                  endDecorator={
                    row.value !== "" ? (
                      <IconButton
                        variant="plain"
                        color="primary"
                        size="sm"
                        onClick={() => updateRow(row.id, { value: "" })}
                      >
                        <Cancel />
                      </IconButton>
                    ) : undefined
                  }
                  value={row.value}
                  onChange={(e) =>
                    updateRow(row.id, { value: e.target.value })
                  }
                  size="sm"
                  sx={{ flex: 1 }}
                />
              )}

              {/* -/+ row controls */}
              <Stack direction="row" spacing={0.5} sx={{ flexShrink: 0 }}>
                {rows.length > 1 && (
                  <IconButton
                    size="sm"
                    variant="outlined"
                    color="danger"
                    onClick={() => removeRow(row.id)}
                    sx={{ aspectRatio: 1 }}
                  >
                    <Remove />
                  </IconButton>
                )}
                <IconButton
                  size="sm"
                  variant="outlined"
                  color="primary"
                  onClick={addRow}
                  sx={{ aspectRatio: 1 }}
                >
                  <Add />
                </IconButton>
              </Stack>

            </Stack>
          );
        })}
      </Stack>
    </Box>
  );
}
