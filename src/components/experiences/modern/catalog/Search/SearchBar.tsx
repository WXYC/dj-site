"use client";

import {
  useAdminCatalogSearch,
} from "@/src/hooks/catalogHooks";
import { Cancel, Troubleshoot } from "@mui/icons-material";
import {
  Box,
  ColorPaletteProp,
  FormControl,
  FormLabel,
  IconButton,
  Input,
} from "@mui/joy";
import { Filters } from "./Filters";
import QueryBuilder from "./QueryBuilder";

function SearchBarInner({
  color,
  searchString,
  setSearchString,
  filterScope,
}: {
  color: ColorPaletteProp | undefined;
  searchString: string;
  setSearchString: (q: string) => void;
  filterScope: "catalog" | "admin";
}) {
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
          <FormLabel>Search for an album or artist</FormLabel>
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

        <Filters color={color} scope={filterScope} />
      </Box>
    </>
  );
}

function CatalogSearchBar({
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
        <Filters color={color} scope="catalog" />
      </Box>
    </Box>
  );
}

function AdminSearchBar({
  color,
}: {
  color: ColorPaletteProp | undefined;
}) {
  const { searchString, setSearchString } = useAdminCatalogSearch();
  return (
    <SearchBarInner
      color={color}
      searchString={searchString}
      setSearchString={setSearchString}
      filterScope="admin"
    />
  );
}

export default function SearchBar({
  color,
  scope = "catalog",
}: {
  color: ColorPaletteProp | undefined;
  scope?: "catalog" | "admin";
}) {
  if (scope === "admin") {
    return <AdminSearchBar color={color} />;
  }
  return <CatalogSearchBar color={color} />;
}
