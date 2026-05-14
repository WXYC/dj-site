"use client";

import { Box, ColorPaletteProp } from "@mui/joy";
import { Filters } from "./Filters";
import QueryBuilder from "./QueryBuilder";

export default function SearchBar({
  color,
}: {
  color: ColorPaletteProp | undefined;
}) {
  return (
    <Box
      className="SearchAndFilters-tabletUp"
      sx={{
        borderRadius: "sm",
        py: 2,
        display: {
          xs: "none",
          sm: "flex",
        },
        flexDirection: "column",
        gap: 1.5,
      }}
    >
      <QueryBuilder />
      <Box
        sx={{
          display: "flex",
          flexWrap: "wrap",
          gap: 1.5,
          "& > *": {
            minWidth: {
              xs: "180px",
              md: "200px",
            },
          },
        }}
      >
        <Filters color={color} />
      </Box>
    </Box>
  );
}
