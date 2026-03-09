"use client";

import { useAppSelector } from "@/lib/hooks";
import { Cancel, FilterAlt, Troubleshoot } from "@mui/icons-material";
import {
  Button,
  ColorPaletteProp,
  IconButton,
  Input,
  Modal,
  ModalClose,
  ModalDialog,
  Sheet,
} from "@mui/joy";
import { Filters } from "./Filters";
import { useCatalogSearch } from "@/src/hooks/catalogHooks";

export default function MobileSearchBar({
  color,
}: {
  color: ColorPaletteProp | undefined;
}) {
  const { searchString, setSearchString, dispatch, catalogSlice } =
    useCatalogSearch();
  const isOpen = useAppSelector(catalogSlice.selectors.isMobileSearchOpen);
  const open = () => dispatch(catalogSlice.actions.openMobileSearch());
  const close = () => dispatch(catalogSlice.actions.closeMobileSearch());

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
      <Input
        color={color ?? "neutral"}
        size="sm"
        placeholder="Search"
        startDecorator={<Troubleshoot />}
        sx={{ flexGrow: 1 }}
        value={searchString}
        onChange={(e) => setSearchString(e.target.value)}
      />
      <IconButton size="sm" variant="outlined" color="neutral" onClick={open}>
        <FilterAlt />
      </IconButton>
      {searchString.length > 0 && (
        <IconButton
          size="sm"
          variant="plain"
          color={color ?? "primary"}
          onClick={() => setSearchString("")}
        >
          <Cancel />
        </IconButton>
      )}
      <Modal open={isOpen} onClose={close}>
        <ModalDialog
          aria-labelledby="filter-modal"
          layout="fullscreen"
          sx={{
            paddingTop: "7rem",
          }}
        >
          <ModalClose
            variant="soft"
            color="primary"
            sx={{ marginTop: "var(--Header-height)" }}
          />
          <Sheet sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <Filters color={color} />
            <Button color={color ?? "primary"} onClick={close}>
              Submit
            </Button>
          </Sheet>
        </ModalDialog>
      </Modal>
    </Sheet>
  );
}
