import type { SxProps } from "@mui/joy/styles/types";

/** Outlined section cards in rightbar forms — aligned with AlbumCard and catalog search shell. */
export const rightbarFormCardSx: SxProps = {
  borderRadius: "md",
  bgcolor: "background.surface",
  flexShrink: 0,
};

/** Focus ring when a card contains active form controls. */
export const rightbarFormCardInteractiveSx: SxProps = {
  "&:focus-within": {
    borderColor: "var(--joy-palette-primary-300)",
    boxShadow: "0 0 0 2px var(--joy-palette-primary-100)",
  },
};

export const rightbarFormCardsStackSx: SxProps = {
  display: "flex",
  flexDirection: "column",
  gap: 1.5,
};
