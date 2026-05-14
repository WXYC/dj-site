"use client";

import type {
  CatalogSortBy,
  CatalogSortOrder,
} from "@/lib/features/catalog/types";
import { useCatalogQuerySearch } from "@/src/hooks/catalogHooks";
import { Option, Select } from "@mui/joy";

type SortChoice = {
  value: `${CatalogSortBy}-${CatalogSortOrder}`;
  label: string;
};

const SORT_OPTIONS: SortChoice[] = [
  { value: "album-asc", label: "Album (A-Z)" },
  { value: "album-desc", label: "Album (Z-A)" },
  { value: "artist-asc", label: "Artist (A-Z)" },
  { value: "artist-desc", label: "Artist (Z-A)" },
  { value: "plays-desc", label: "Plays (most)" },
  { value: "plays-asc", label: "Plays (fewest)" },
  { value: "date-desc", label: "Date Added (newest)" },
  { value: "date-asc", label: "Date Added (oldest)" },
];

export default function SortBySelect() {
  const { sortBy, sortOrder, setSort } = useCatalogQuerySearch();
  const sortValue = `${sortBy}-${sortOrder}` as SortChoice["value"];

  const handleSortChange = (_: unknown, value: string | null) => {
    if (!value) return;
    const [field, order] = value.split("-") as [CatalogSortBy, CatalogSortOrder];
    setSort({ sortBy: field, sortOrder: order });
  };

  return (
    <Select
      size="sm"
      color="primary"
      value={sortValue}
      slotProps={{ button: { sx: { whiteSpace: "nowrap" } } }}
      onChange={handleSortChange}
      sx={{ minWidth: 180, flexShrink: 0 }}
    >
      {SORT_OPTIONS.map((opt) => (
        <Option key={opt.value} value={opt.value}>
          {opt.label}
        </Option>
      ))}
    </Select>
  );
}
