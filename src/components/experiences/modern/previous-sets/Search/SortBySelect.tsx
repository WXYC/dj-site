"use client";

import { usePlaylistSearch } from "@/src/hooks/playlistSearchHooks";
import { Option, Select } from "@mui/joy";

export default function SortBySelect() {
  const { sortBy, sortOrder, handleSort } = usePlaylistSearch();

  const sortValue = `${sortBy}-${sortOrder}`;

  const handleSortChange = (_: unknown, value: string | null) => {
    if (!value) return;
    const [field] = value.split("-") as ["date" | "artist" | "song" | "dj"];
    handleSort(field);
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
      <Option value="date-desc">Date (Newest)</Option>
      <Option value="date-asc">Date (Oldest)</Option>
      <Option value="artist-desc">Artist (Z-A)</Option>
      <Option value="artist-asc">Artist (A-Z)</Option>
      <Option value="dj-desc">DJ (Z-A)</Option>
      <Option value="dj-asc">DJ (A-Z)</Option>
    </Select>
  );
}
