"use client";

import PageHeader from "@/src/components/experiences/modern/Header/PageHeader";
import MobileSearchBar from "@/src/components/experiences/modern/catalog/Search/MobileSearchBar";
import SearchBar from "@/src/components/experiences/modern/catalog/Search/SearchBar";
import Results from "@/src/components/experiences/modern/catalog/Results/Results";
import CatalogEditMenu from "./CatalogEditMenu";
import { Box } from "@mui/joy";

export default function CatalogExperience() {
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        flex: 1,
        minHeight: 0,
        overflow: "hidden",
      }}
    >
      <PageHeader title="Card Catalog">
        <CatalogEditMenu />
      </PageHeader>
      <MobileSearchBar color="primary" />
      <SearchBar color="primary" />
      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          transition: "flex 0.25s ease-in-out",
        }}
      >
        <Results color="primary" />
      </Box>
    </Box>
  );
}
