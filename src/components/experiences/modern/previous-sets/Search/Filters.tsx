"use client";

import type { SimpleSearchField } from "@/lib/features/playlist-search/frontend";
import { usePlaylistSearch } from "@/src/hooks/playlistSearchHooks";
import { FormControl, FormLabel, Option, Select } from "@mui/joy";
import React from "react";

const SEARCH_FIELD_OPTIONS: { value: SimpleSearchField; label: string }[] = [
  { value: "all", label: "All" },
  { value: "artist", label: "Artist" },
  { value: "song", label: "Song" },
  { value: "album", label: "Album" },
  { value: "label", label: "Label" },
  { value: "dj", label: "DJ" },
];

export default function Filters() {
  const { searchField, setSearchField, sortBy, sortOrder, handleSort } =
    usePlaylistSearch();

  const sortValue = `${sortBy}-${sortOrder}`;

  const handleSortChange = (_: unknown, value: string | null) => {
    if (!value) return;
    const [field] = value.split("-") as ["date" | "artist" | "song" | "dj"];
    // Toggle sort — if same field, it flips order; if different, sets desc
    handleSort(field);
  };

  return (
    <React.Fragment>
      <FormControl size="sm" sx={{ flex: 1 }}>
        <FormLabel>Search In</FormLabel>
        <Select
          color="primary"
          placeholder="All"
          value={searchField}
          slotProps={{ button: { sx: { whiteSpace: "nowrap" } } }}
          onChange={(_, newValue) =>
            setSearchField((newValue as SimpleSearchField) || "all")
          }
        >
          {SEARCH_FIELD_OPTIONS.map((opt) => (
            <Option key={opt.value} value={opt.value}>
              {opt.label}
            </Option>
          ))}
        </Select>
      </FormControl>
      <FormControl size="sm" sx={{ flex: 1 }}>
        <FormLabel>Sort By</FormLabel>
        <Select
          color="primary"
          value={sortValue}
          slotProps={{ button: { sx: { whiteSpace: "nowrap" } } }}
          onChange={handleSortChange}
        >
          <Option value="date-desc">Date (Newest)</Option>
          <Option value="date-asc">Date (Oldest)</Option>
          <Option value="artist-desc">Artist (Z-A)</Option>
          <Option value="artist-asc">Artist (A-Z)</Option>
          <Option value="dj-desc">DJ (Z-A)</Option>
          <Option value="dj-asc">DJ (A-Z)</Option>
        </Select>
      </FormControl>
    </React.Fragment>
  );
}
