/** Catalog modals sit above the mobile rightbar (9999). Popovers must exceed the modal. */
export const CATALOG_MODAL_Z_INDEX = 90000;
export const CATALOG_MODAL_POPOVER_Z_INDEX = 90001;

export const catalogModalSelectSlotProps = {
  listbox: {
    sx: { zIndex: CATALOG_MODAL_POPOVER_Z_INDEX },
  },
} as const;

export const catalogModalAutocompleteSlotProps = {
  listbox: {
    sx: {
      zIndex: CATALOG_MODAL_POPOVER_Z_INDEX,
      py: 0.5,
      "--ListItem-paddingX": "12px",
    },
  },
} as const;
