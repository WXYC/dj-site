"use client";

import { catalogSlice } from "@/lib/features/catalog/frontend";
import { useAppSelector } from "@/lib/hooks";
import {
  useAdminCatalogSearch,
  useCatalogSearch,
} from "@/src/hooks/catalogHooks";
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

function CatalogMobileSearchBar({
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
            <Filters color={color} scope="catalog" />
            <Button color={color ?? "primary"} onClick={close}>
              Submit
            </Button>
          </Sheet>
        </ModalDialog>
      </Modal>
    </Sheet>
  );
}

function AdminMobileSearchBar({
  color,
}: {
  color: ColorPaletteProp | undefined;
}) {
  const { searchString, setSearchString, dispatch } = useAdminCatalogSearch();
  const isOpen = useAppSelector(
    catalogSlice.selectors.isAdminCatalogMobileSearchOpen
  );
  const open = () => dispatch(catalogSlice.actions.openAdminCatalogMobileSearch());
  const close = () =>
    dispatch(catalogSlice.actions.closeAdminCatalogMobileSearch());

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
          aria-labelledby="filter-modal-admin"
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
            <Filters color={color} scope="admin" />
            <Button color={color ?? "primary"} onClick={close}>
              Submit
            </Button>
          </Sheet>
        </ModalDialog>
      </Modal>
    </Sheet>
  );
}

export default function MobileSearchBar({
  color,
  scope = "catalog",
}: {
  color: ColorPaletteProp | undefined;
  scope?: "catalog" | "admin";
}) {
  if (scope === "admin") {
    return <AdminMobileSearchBar color={color} />;
  }
  return <CatalogMobileSearchBar color={color} />;
}
