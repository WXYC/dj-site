"use client";

import type {
  SortField,
  SortOrder,
} from "@/lib/features/playlist-search/frontend";
import { usePlaylistSearch } from "@/src/hooks/playlistSearchHooks";
import { Option, Select } from "@mui/joy";

type SortChoice = {
  value: `${SortField}-${SortOrder}`;
  label: string;
};

const SORT_OPTIONS: SortChoice[] = [
  { value: "date-desc", label: "Date (Newest)" },
  { value: "date-asc", label: "Date (Oldest)" },
  { value: "artist-desc", label: "Artist (Z-A)" },
  { value: "artist-asc", label: "Artist (A-Z)" },
  { value: "dj-desc", label: "DJ (Z-A)" },
  { value: "dj-asc", label: "DJ (A-Z)" },
];

export default function SortBySelect() {
  const { sortBy, sortOrder, setSort } = usePlaylistSearch();

  const sortValue = `${sortBy}-${sortOrder}` as SortChoice["value"];

  const handleSortChange = (_: unknown, value: string | null) => {
    if (!value) return;
    // The option value carries a direction as well as a field, and both are
    // applied: dropping the direction half leaves the listing contradicting
    // the label the DJ just picked.
    const [field, order] = value.split("-") as [SortField, SortOrder];
    setSort({ sortBy: field, sortOrder: order });
  };

  return (
    <Select
      size="sm"
      color="primary"
      value={sortValue}
      slotProps={{ button: { sx: { whiteSpace: "nowrap" } } }}
      onChange={handleSortChange}
      sx={{ minWidth: 160, flexShrink: 0 }}
    >
      {SORT_OPTIONS.map((opt) => (
        <Option key={opt.value} value={opt.value}>
          {opt.label}
        </Option>
      ))}
    </Select>
  );
}
