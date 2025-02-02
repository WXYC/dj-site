"use client";

import { useCatalogSearch } from "@/src/hooks/catalogHooks";
import { Cancel, Troubleshoot } from "@mui/icons-material";
import {
    Box,
    ColorPaletteProp,
    FormControl,
    FormLabel,
    IconButton,
    Input
} from "@mui/joy";
import { Filters } from "./Filters";

export default function SearchBar({
  color,
}: {
  color: ColorPaletteProp | undefined;
}) {
  const { searchString, setSearchString } = useCatalogSearch();

  return (
    <>
    <Box
      className="SearchAndFilters-tabletUp"
      sx={{
        borderRadius: "sm",
        py: 2,
        display: {
          xs: "none",
          sm: "flex",
        },
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
      <FormControl
        sx={{ flex: 1, flexBasis: { xs: "100%", lg: "50%" } }}
        size="sm"
      >
        <FormLabel>Search for a song, album, or artist</FormLabel>
        <Input
          color={color ?? "neutral"}
          placeholder="Search"
          startDecorator={<Troubleshoot />}
          endDecorator={
            searchString != "" ? (
              <IconButton
                variant="plain"
                color={color ?? "primary"}
                onClick={() => setSearchString("")}
              >
                <Cancel />
              </IconButton>
            ) : (
              <></>
            )
          }
          value={searchString}
          onChange={(e) => setSearchString(e.target.value)}
        />
      </FormControl>

      <Filters color={color} />
    </Box>
    </>
  );
}
