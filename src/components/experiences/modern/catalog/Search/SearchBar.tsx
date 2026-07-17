"use client";

import type { LibraryGenreRow } from "@/lib/features/catalog/types";
import { Box, ColorPaletteProp } from "@mui/joy";
import QueryBuilder from "./QueryBuilder";

export default function SearchBar({
  color,
  initialGenres,
}: {
  color: ColorPaletteProp | undefined;
  initialGenres?: LibraryGenreRow[];
}) {
  return (
    <Box
      className="SearchAndFilters-tabletUp"
      sx={{
        borderRadius: "sm",
        py: 1,
        display: {
          xs: "none",
          sm: "block",
        },
        flexShrink: 0,
        minWidth: 0,
      }}
    >
      <QueryBuilder color={color} initialGenres={initialGenres} />
    </Box>
  );
}
