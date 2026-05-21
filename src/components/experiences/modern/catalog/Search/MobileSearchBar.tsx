"use client";

import { catalogSlice } from "@/lib/features/catalog/frontend";
import { useAppSelector } from "@/lib/hooks";
import { useCatalogQuerySearch } from "@/src/hooks/catalogHooks";
import { FilterAlt } from "@mui/icons-material";
import {
  Button,
  ColorPaletteProp,
  IconButton,
  Modal,
  ModalClose,
  ModalDialog,
  Sheet,
} from "@mui/joy";
import { Filters } from "./Filters";
import QueryBuilder from "./QueryBuilder";

export default function MobileSearchBar({
  color,
}: {
  color: ColorPaletteProp | undefined;
}) {
  const { openMobileSearch, closeMobileSearch } = useCatalogQuerySearch();
  const isOpen = useAppSelector(catalogSlice.selectors.isMobileSearchOpen);

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
        gap: 1,
      }}
    >
      <Button
        size="sm"
        variant="outlined"
        color={color ?? "primary"}
        sx={{ flexGrow: 1 }}
        onClick={openMobileSearch}
      >
        Build a catalog query
      </Button>
      <IconButton
        size="sm"
        variant="outlined"
        color="neutral"
        onClick={openMobileSearch}
        aria-label="Open filters"
      >
        <FilterAlt />
      </IconButton>
      <Modal open={isOpen} onClose={closeMobileSearch}>
        <ModalDialog
          aria-labelledby="filter-modal"
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
            <QueryBuilder />
            <Filters color={color} />
            <Button color={color ?? "primary"} onClick={closeMobileSearch}>
              Submit
            </Button>
          </Sheet>
        </ModalDialog>
      </Modal>
    </Sheet>
  );
}
