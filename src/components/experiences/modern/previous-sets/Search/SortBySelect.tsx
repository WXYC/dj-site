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
    const [field, order] = value.split("-") as [SortField, SortOrder];
    setSort({ sortBy: field, sortOrder: order });
  };

  return (
    <Select
      size="sm"
      color="primary"
      value={sortValue}
      // The button carries no text of its own beyond the active option, so
      // without a name the control is announced — and locatable — only by
      // whichever sort happens to be in effect.
      slotProps={{
        button: { "aria-label": "Sort by", sx: { whiteSpace: "nowrap" } },
      }}
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
