"use client";

import type { SearchRow } from "@/lib/features/playlist-search/frontend";
import { Add, Remove } from "@mui/icons-material";
import {
  Box,
  Checkbox,
  IconButton,
  Input,
  Option,
  Select,
  Stack,
} from "@mui/joy";

interface PlaylistSearchRowProps {
  row: SearchRow;
  isFirst: boolean;
  canRemove: boolean;
  onUpdate: (updates: Partial<SearchRow>) => void;
  onAdd: () => void;
  onRemove: () => void;
}

const FIELD_OPTIONS = [
  { value: "artist", label: "Artist" },
  { value: "song", label: "Song Title" },
  { value: "album", label: "Album Name" },
  { value: "label", label: "Label" },
  { value: "dj", label: "DJ Name" },
  { value: "date", label: "Date" },
  { value: "dateRange", label: "Date Range" },
] as const;

const OPERATOR_OPTIONS = [
  { value: "AND", label: "AND" },
  { value: "OR", label: "OR" },
  { value: "NOT", label: "NOT" },
] as const;

export default function PlaylistSearchRow({
  row,
  isFirst,
  canRemove,
  onUpdate,
  onAdd,
  onRemove,
}: PlaylistSearchRowProps) {
  const isDateField = row.field === "date";
  const isDateRangeField = row.field === "dateRange";

  return (
    <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1 }}>
      {/* Operator dropdown - hidden on first row */}
      <Box sx={{ minWidth: 80, visibility: isFirst ? "hidden" : "visible" }}>
        <Select
          value={row.operator}
          onChange={(_, value) => value && onUpdate({ operator: value })}
          size="sm"
        >
          {OPERATOR_OPTIONS.map((opt) => (
            <Option key={opt.value} value={opt.value}>
              {opt.label}
            </Option>
          ))}
        </Select>
      </Box>

      {/* Field dropdown */}
      <Box sx={{ minWidth: 130 }}>
        <Select
          value={row.field}
          onChange={(_, value) =>
            value && onUpdate({ field: value, value: "", valueTo: undefined })
          }
          size="sm"
        >
          {FIELD_OPTIONS.map((opt) => (
            <Option key={opt.value} value={opt.value}>
              {opt.label}
            </Option>
          ))}
        </Select>
      </Box>

      {/* Input field(s) - changes based on field type */}
      {isDateField ? (
        <Input
          type="date"
          value={row.value}
          onChange={(e) => onUpdate({ value: e.target.value })}
          size="sm"
          sx={{ minWidth: 150 }}
        />
      ) : isDateRangeField ? (
        <>
          <Input
            type="date"
            value={row.value}
            onChange={(e) => onUpdate({ value: e.target.value })}
            size="sm"
            sx={{ minWidth: 140 }}
            placeholder="From"
          />
          <Input
            type="date"
            value={row.valueTo || ""}
            onChange={(e) => onUpdate({ valueTo: e.target.value })}
            size="sm"
            sx={{ minWidth: 140 }}
            placeholder="To"
          />
        </>
      ) : (
        <Input
          value={row.value}
          onChange={(e) => onUpdate({ value: e.target.value })}
          size="sm"
          sx={{ flex: 1, minWidth: 200 }}
          placeholder={`Enter ${FIELD_OPTIONS.find((f) => f.value === row.field)?.label.toLowerCase()}...`}
        />
      )}

      {/* Exact match checkbox - only for text fields */}
      {!isDateField && !isDateRangeField && (
        <Checkbox
          label="Exact"
          checked={row.exact}
          onChange={(e) => onUpdate({ exact: e.target.checked })}
          size="sm"
          sx={{ alignSelf: "center" }}
        />
      )}

      {/* Row controls */}
      <Stack direction="row" spacing={0.5}>
        <IconButton size="sm" variant="outlined" onClick={onAdd}>
          <Add />
        </IconButton>
        {canRemove && (
          <IconButton size="sm" variant="outlined" color="danger" onClick={onRemove}>
            <Remove />
          </IconButton>
        )}
      </Stack>
    </Stack>
  );
}
