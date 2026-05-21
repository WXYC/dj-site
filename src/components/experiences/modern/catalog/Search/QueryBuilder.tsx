"use client";

import type { CatalogSearchField } from "@/lib/features/catalog/types";
import { useCatalogQuerySearch } from "@/src/hooks/catalogHooks";
import { Add, Cancel, Remove, Troubleshoot } from "@mui/icons-material";
import { Box, IconButton, Input, Option, Select, Stack } from "@mui/joy";
import SortBySelect from "./SortBySelect";

const FIELD_OPTIONS: { value: CatalogSearchField; label: string }[] = [
  { value: "all", label: "All" },
  { value: "artist", label: "Artist" },
  { value: "album", label: "Album" },
  { value: "label", label: "Label" },
];

const OPERATOR_OPTIONS = [
  { value: "AND" as const, label: "AND" },
  { value: "OR" as const, label: "OR" },
  { value: "NOT" as const, label: "NOT" },
];

export default function QueryBuilder() {
  const { rows, addRow, removeRow, updateRow } = useCatalogQuerySearch();

  return (
    // Responsive show/hide is the caller's responsibility — SearchBar hides
    // this on xs (the mobile modal renders it back in instead).
    <Box sx={{ py: 1 }}>
      <Stack spacing={1}>
        {rows.map((row, index) => {
          const isFirst = index === 0;
          return (
            <Stack
              key={row.id}
              direction="row"
              spacing={1}
              sx={{ alignItems: "center" }}
            >
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

              {isFirst && <SortBySelect />}

              <Select
                value={row.field}
                onChange={(_, value) =>
                  value &&
                  updateRow(row.id, {
                    field: value,
                    value: "",
                  })
                }
                size="sm"
                color="primary"
                slotProps={{ button: { sx: { whiteSpace: "nowrap" } } }}
                sx={{ minWidth: 100, flexShrink: 0 }}
              >
                {FIELD_OPTIONS.map((opt) => (
                  <Option key={opt.value} value={opt.value}>
                    {opt.label}
                  </Option>
                ))}
              </Select>

              <Input
                color="primary"
                placeholder="Search the catalog"
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
                onChange={(e) => {
                  // Quoted input toggles the row's exact-match flag. The
                  // service-side parser will still see the quotes if the user
                  // typed them, but tracking `exact` on the row lets the UI
                  // surface it (and lets buildCatalogQuery re-quote on submit).
                  const next = e.target.value;
                  const exact = next.startsWith('"') && next.endsWith('"') && next.length >= 2;
                  updateRow(row.id, { value: exact ? next.slice(1, -1) : next, exact });
                }}
                size="sm"
                sx={{ flex: 1 }}
              />

              <Stack direction="row" spacing={0.5} sx={{ flexShrink: 0 }}>
                {rows.length > 1 && (
                  <IconButton
                    size="sm"
                    variant="outlined"
                    color="danger"
                    onClick={() => removeRow(row.id)}
                    sx={{ aspectRatio: 1 }}
                    aria-label="Remove row"
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
                  aria-label="Add row"
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
