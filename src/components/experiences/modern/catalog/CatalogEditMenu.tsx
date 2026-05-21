"use client";

import { applicationSlice } from "@/lib/features/application/frontend";
import { useAppDispatch } from "@/lib/hooks";
import { useCanEditCatalog } from "@/src/hooks/catalogHooks";
import { Edit, LibraryMusic, PersonAdd } from "@mui/icons-material";
import { Button, Dropdown, Menu, MenuButton, MenuItem } from "@mui/joy";

export default function CatalogEditMenu() {
  const dispatch = useAppDispatch();
  const canEdit = useCanEditCatalog();

  if (!canEdit) {
    return null;
  }

  return (
    <Dropdown>
      <MenuButton
        slots={{ root: Button }}
        slotProps={{
          root: {
            variant: "outlined",
            color: "success",
            size: "sm",
            startDecorator: <Edit />,
            "data-testid": "catalog-edit-button",
            "aria-label": "Edit catalog",
          },
        }}
      >
        Edit
      </MenuButton>
      <Menu sx={{ zIndex: 1100 }} placement="bottom-end">
        <MenuItem
          onClick={() =>
            dispatch(
              applicationSlice.actions.openPanel({
                type: "admin-catalog-add-album",
              })
            )
          }
        >
          <LibraryMusic />
          Add album
        </MenuItem>
        <MenuItem
          onClick={() =>
            dispatch(
              applicationSlice.actions.openPanel({
                type: "admin-catalog-add-artist",
              })
            )
          }
        >
          <PersonAdd />
          Add artist
        </MenuItem>
      </Menu>
    </Dropdown>
  );
}
