"use client";

import { Add as AddIcon, LibraryMusic, PersonAdd } from "@mui/icons-material";
import {
  Dropdown,
  IconButton,
  Menu,
  MenuButton,
  MenuItem,
} from "@mui/joy";

export type AdminCatalogAddMenuProps = {
  onAddAlbum: () => void;
  onAddArtist: () => void;
};

/**
 * Floating “add” control for catalog admin — Joy Menu (no MUI Material theme).
 * Proxies add actions to the parent (e.g. open Rightbar panels).
 */
export default function AdminCatalogAddMenu({
  onAddAlbum,
  onAddArtist,
}: AdminCatalogAddMenuProps) {
  return (
    <Dropdown>
      <MenuButton
        slots={{ root: IconButton }}
        slotProps={{
          root: {
            variant: "solid",
            color: "success",
            size: "lg",
            "aria-label": "Add to catalog",
            sx: {
              borderRadius: "50%",
              width: 56,
              height: 56,
              boxShadow: "md",
            },
          },
        }}
      >
        <AddIcon />
      </MenuButton>
      <Menu
        sx={{ zIndex: 1100 }}
        popperOptions={{ placement: "top-end" }}
      >
        <MenuItem onClick={onAddAlbum}>
          <LibraryMusic />
          Add album
        </MenuItem>
        <MenuItem onClick={onAddArtist}>
          <PersonAdd />
          Add artist
        </MenuItem>
      </Menu>
    </Dropdown>
  );
}
