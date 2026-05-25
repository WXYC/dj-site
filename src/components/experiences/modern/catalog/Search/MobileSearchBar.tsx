"use client";

import { catalogSlice } from "@/lib/features/catalog/frontend";
import { useAppSelector } from "@/lib/hooks";
import { useCatalogQuerySearch } from "@/src/hooks/catalogHooks";
import { Troubleshoot } from "@mui/icons-material";
import {
  Box,
  Button,
  ColorPaletteProp,
  Modal,
  ModalClose,
  ModalDialog,
  Sheet,
  Typography,
} from "@mui/joy";
import { catalogFiltersActive } from "./Filters";
import QueryBuilder from "./QueryBuilder";

export default function MobileSearchBar({
  color,
}: {
  color: ColorPaletteProp | undefined;
}) {
  const { openMobileSearch, closeMobileSearch, filters, effectiveQuery } =
    useCatalogQuerySearch();
  const isOpen = useAppSelector(catalogSlice.selectors.isMobileSearchOpen);
  const filtersActive = catalogFiltersActive(filters);
  const preview =
    effectiveQuery.trim() ||
    (filtersActive ? "Filters active" : "Search the catalog");

  return (
    <Sheet
      className="SearchAndFilters-mobile"
      sx={{
        background: "transparent",
        display: {
          xs: "flex",
          sm: "none",
        },
        my: 1,
      }}
    >
      <Button
        size="sm"
        variant="outlined"
        color={color ?? "primary"}
        sx={{
          flexGrow: 1,
          justifyContent: "flex-start",
          gap: 1,
          fontWeight: "normal",
          color: effectiveQuery.trim() ? "text.primary" : "text.tertiary",
        }}
        onClick={openMobileSearch}
        startDecorator={<Troubleshoot />}
      >
        <Typography level="body-sm" noWrap sx={{ flex: 1, textAlign: "left" }}>
          {preview}
        </Typography>
      </Button>
      <Modal open={isOpen} onClose={closeMobileSearch}>
        <ModalDialog
          aria-labelledby="catalog-search-modal"
          layout="fullscreen"
          sx={{
            paddingTop: "7rem",
          }}
        >
          <ModalClose
            variant="soft"
            color={color ?? "primary"}
            sx={{ marginTop: "var(--Header-height)" }}
          />
          <Sheet sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <Box sx={{ flexGrow: 1, minWidth: 0 }}>
              <QueryBuilder color={color} />
            </Box>
            <Button color={color ?? "primary"} onClick={closeMobileSearch}>
              Done
            </Button>
          </Sheet>
        </ModalDialog>
      </Modal>
    </Sheet>
  );
}
