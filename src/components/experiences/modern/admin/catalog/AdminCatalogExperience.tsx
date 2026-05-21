"use client";

import { applicationSlice } from "@/lib/features/application/frontend";
import { useAppDispatch } from "@/lib/hooks";
import PageHeader from "@/src/components/experiences/modern/Header/PageHeader";
import MobileSearchBar from "@/src/components/experiences/modern/catalog/Search/MobileSearchBar";
import SearchBar from "@/src/components/experiences/modern/catalog/Search/SearchBar";
import Results from "@/src/components/experiences/modern/catalog/Results/Results";
import { Box } from "@mui/joy";
import AdminCatalogAddMenu from "./AdminCatalogAddMenu";

export default function AdminCatalogExperience() {
  const dispatch = useAppDispatch();

  return (
    <>
      <PageHeader title="Catalog admin" />
      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          position: "relative",
          display: "flex",
          flexDirection: "column",
          gap: 1,
        }}
      >
        <MobileSearchBar color="success" scope="admin" />
        <SearchBar color="success" scope="admin" />
        <Results color="success" scope="admin" />
        <Box
          sx={{
            position: "absolute",
            bottom: { xs: 16, sm: 24 },
            right: { xs: 8, sm: 16 },
            zIndex: 1000,
          }}
        >
          <AdminCatalogAddMenu
            onAddAlbum={() =>
              dispatch(
                applicationSlice.actions.openPanel({
                  type: "admin-catalog-add-album",
                })
              )
            }
            onAddArtist={() =>
              dispatch(
                applicationSlice.actions.openPanel({
                  type: "admin-catalog-add-artist",
                })
              )
            }
          />
        </Box>
      </Box>
    </>
  );
}
